#!/usr/bin/env python3
"""Run the existing scoped repairs with a lock, private backups and durable results."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import subprocess
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--app-dir', default='/opt/aicourtsystem')
    parser.add_argument('--project', default='docker')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run through Ansible with become/root.')
    import re
    if not re.fullmatch(r'/[A-Za-z0-9/_-]+', args.app_dir) or args.app_dir == '/':
        raise SystemExit('Invalid application path')
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', args.project):
        raise SystemExit('Invalid Compose project')
    os.umask(0o077)
    root = Path('/var/lib/justisolve-hard-repair')
    root.mkdir(mode=0o700, exist_ok=True)
    os.chmod(root, 0o700)
    with (root / 'repair.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Another hard repair is running; let it finish.')
        run = root / (time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + str(os.getpid()))
        run.mkdir(mode=0o700)
        log_path = run / 'repair.log'
        report = {'status': 'running', 'stage': 'preflight', 'log': str(log_path), 'backup': str(run)}
        report_path = root / 'report.json'

        def save():
            temporary = root / 'report.tmp'
            temporary.write_text(json.dumps(report, indent=2) + '\n')
            os.replace(temporary, report_path)
            (run / 'report.json').write_text(json.dumps(report, indent=2) + '\n')

        save()
        try:
            app = Path(args.app_dir)
            if not (app / '.env').is_file() or not (app / 'docker/docker-compose.yml').is_file():
                raise RuntimeError('Existing .env and Compose installation required')
            shutil.copyfile(app / '.env', run / 'production.env')
            source = Path(__file__).resolve().parent.parent
            variables = run / 'variables.json'
            variables.write_text(json.dumps({'app_dir': args.app_dir, 'compose_project': args.project}))
            with log_path.open('w') as log:
                def execute(stage, command, cwd=None):
                    report['stage'] = stage
                    save()
                    log.write('\nSTAGE: ' + stage + '\n')
                    log.flush()
                    result = subprocess.run(command, cwd=cwd, stdout=log, stderr=subprocess.STDOUT)
                    if result.returncode:
                        raise RuntimeError(stage + ' failed; inspect the private repair log')

                plugin = subprocess.run(['docker', 'compose', 'version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                compose = ['docker', 'compose'] if plugin.returncode == 0 else ['docker-compose']
                base = compose + ['-p', args.project, '--env-file', '.env', '-f', 'docker/docker-compose.yml']
                execute('start database and cache', base + ['up', '-d', '--no-recreate', 'postgres', 'redis'], app)
                # Existing scoped playbooks retain their certificate checks, source-change protection,
                # gateway reload, service timers and real public HTTPS verification.
                execute('TLS, application, gateway and public HTTPS repair',
                        ['ansible-playbook', '-i', 'localhost,', '-c', 'local',
                         str(source / 'ansible/repair-https.yml'), '-e', '@' + str(variables)])
            report.update(status='passed', stage='complete')
        except Exception as error:
            report.update(status='failed', reason=str(error))
        finally:
            save()
        print(json.dumps(report, indent=2))
        return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
