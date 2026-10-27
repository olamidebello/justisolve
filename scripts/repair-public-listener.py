#!/usr/bin/env python3
"""Add an explicitly selected local IPv4 listener to the existing JustiSolve TLS block."""
import argparse, importlib.util, ipaddress, json, os, re, shutil, socket, subprocess, tempfile, time
from pathlib import Path


def patch(text, address):
    # Keep source offsets while ignoring comments and quoted punctuation.
    lex = list(re.finditer(r'#[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[{};]|[^\s{};#"\']+', text))
    stack=[]; statement=[]; edits=[]
    for token in lex:
        word=token.group()
        if word.startswith('#'): continue
        if word=='{':
            stack.append({'kind':statement[:], 'start':token.end(), 'directives':[]}); statement=[]
        elif word==';':
            if stack: stack[-1]['directives'].append(statement[:])
            statement=[]
        elif word=='}':
            if not stack: raise ValueError('Unbalanced configuration')
            block=stack.pop(); statement=[]
            if block['kind']!=['server']: continue
            directives=block['directives']
            names=[w.strip('\"\'') for d in directives if d and d[0]=='server_name' for w in d[1:]]
            if 'justisolve.com' not in names: continue
            if set(names)-{'justisolve.com','www.justisolve.com'}: raise ValueError('Shared virtual host refused')
            listens=[d for d in directives if d and d[0]=='listen']
            if not any(len(d)>1 and d[1] in ('443','0.0.0.0:443','*:443') and 'ssl' in d for d in listens): continue
            if any(len(d)>1 and d[1]==address+':443' for d in listens): continue
            edits.append(block['start'])
        else:
            statement.append(word)
    if stack: raise ValueError('Unbalanced configuration')
    if len(edits)>1: raise ValueError('Multiple candidate TLS blocks refused')
    for position in reversed(edits): text=text[:position]+'\n    listen '+address+':443 ssl; # JustiSolve public SNI routing\n'+text[position:]
    return text


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--address',required=True); args=parser.parse_args()
    address=str(ipaddress.IPv4Address(args.address))
    local=json.loads(subprocess.check_output(['ip','-j','-4','address','show'],text=True))
    if address not in {a['local'] for interface in local for a in interface.get('addr_info',[])}:
        raise SystemExit('Selected IPv4 is not assigned to this server')
    spec=importlib.util.spec_from_file_location('preflight',Path(__file__).with_name('tls-preflight.py'))
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    dump=subprocess.run(['nginx','-T'],capture_output=True,text=True,check=True)
    plan=module.inspect_dump(dump.stdout,dump.stderr)
    updates={}
    for filename in plan['configuration_files']:
        path=Path(filename).resolve(strict=True); original=path.read_text(); changed=patch(original,address)
        if changed!=original: updates[path]=(original,changed)
    os.umask(0o077)
    root=Path('/var/lib/justisolve-tls-repair'); root.mkdir(mode=0o700,exist_ok=True)
    backup=Path(tempfile.mkdtemp(prefix='listener-',dir=root))
    def write(path,content):
        mode=path.stat().st_mode & 0o777
        fd,name=tempfile.mkstemp(dir=path.parent,prefix='.justisolve-')
        try:
            with os.fdopen(fd,'w') as out: out.write(content); out.flush(); os.fsync(out.fileno())
            os.chmod(name,mode); os.replace(name,path)
        finally:
            if os.path.exists(name): os.unlink(name)
    try:
        for index,(path,(original,changed)) in enumerate(updates.items()):
            (backup/str(index)).write_text(original); write(path,changed)
        subprocess.run(['nginx','-t'],capture_output=True,check=True)
        subprocess.run(['systemctl','reload','nginx'],capture_output=True,check=True)
        context=__import__('ssl').create_default_context()
        for attempt in range(10):
            try:
                with socket.create_connection((address,443),timeout=5) as raw:
                    with context.wrap_socket(raw,server_hostname='justisolve.com'): pass
                break
            except (OSError, __import__('ssl').SSLError):
                if attempt == 9: raise
                time.sleep(2)
    except Exception as error:
        for path,(original,_) in updates.items(): write(path,original)
        subprocess.run(['nginx','-t'],capture_output=True,check=True)
        subprocess.run(['systemctl','reload','nginx'],capture_output=True,check=True)
        detail = (error.stderr.decode(errors='replace') if isinstance(error.stderr, bytes) else error.stderr) if isinstance(error, subprocess.CalledProcessError) else str(error)
        raise SystemExit('Public listener repair failed; restored configuration. Cause: ' + str(detail))
    print(json.dumps({'changed':bool(updates),'public_ipv4':address,'trusted_public_address_tls':True,'backup':str(backup)}))

if __name__=='__main__': main()
