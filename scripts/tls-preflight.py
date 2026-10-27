#!/usr/bin/env python3
"""Find exact JustiSolve Nginx names and back up their active files; never rewrite them."""
import argparse,hashlib,json,re,shlex,shutil,subprocess
from pathlib import Path
ALLOWED={'justisolve.com','www.justisolve.com'}
def tokens(text):
    result=[];word='';quote=None;escaped=False;i=0
    while i<len(text):
        ch=text[i]
        if escaped:word+=ch;escaped=False
        elif ch=='\\':escaped=True
        elif quote:
            if ch==quote:quote=None
            else:word+=ch
        elif ch in "\"'":quote=ch
        elif ch=='#':
            if word:result.append(('word',word));word=''
            end=text.find('\n',i);i=len(text) if end<0 else end;continue
        elif ch in '{};':
            if word:result.append(('word',word));word=''
            result.append(('punct',ch))
        elif ch.isspace():
            if word:result.append(('word',word));word=''
        else:word+=ch
        i+=1
    if quote or escaped:raise ValueError('Unterminated Nginx token')
    if word:result.append(('word',word))
    return result
def inspect_dump(dump,warnings=''):
    for line in warnings.splitlines():
        if 'conflicting server name' in line.lower() and any(name in line.lower() for name in ALLOWED):raise ValueError('Conflicting JustiSolve server names; resolve duplicate active virtual hosts before requesting a certificate.')
    parts=re.split(r'(?m)^# configuration file (.+):\s*\n',dump);found=set();files=set()
    for position in range(1,len(parts),2):
        filename=parts[position];ts=tokens(parts[position+1]);i=0
        while i<len(ts):
            if ts[i]==('word','server_name') and (i==0 or ts[i-1][0]=='punct'):
                names=[];i+=1
                while i<len(ts) and ts[i][0]=='word':names.append(ts[i][1].lower());i+=1
                relevant=set(names)&ALLOWED
                if relevant:
                    if set(names)-ALLOWED:raise ValueError('JustiSolve shares a server block with other names; isolate its virtual host before TLS repair.')
                    if not Path(filename).is_absolute():raise ValueError('Unexpected Nginx source path')
                    found.update(relevant);files.add(filename)
            else:i+=1
    if 'justisolve.com' not in found:raise ValueError('No exact active server_name justisolve.com found. Configure the JustiSolve host routing first; no backend port was guessed.')
    return {'names':sorted(found),'configuration_files':sorted(files)}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--backup-dir',type=Path,required=True);args=parser.parse_args()
    check=subprocess.run(['nginx','-t'],capture_output=True,text=True,check=True)
    current=subprocess.run(['nginx','-T'],capture_output=True,text=True,check=True)
    result=inspect_dump(current.stdout,check.stderr+'\n'+current.stderr)
    args.backup_dir.mkdir(parents=True,exist_ok=False,mode=0o700);saved=[]
    for filename in result['configuration_files']:
        source=Path(filename).resolve(strict=True)
        if not source.is_file():raise ValueError('Active Nginx configuration is not a regular file')
        destination=args.backup_dir/(hashlib.sha256(str(source).encode()).hexdigest()+'.conf')
        shutil.copyfile(source,destination);destination.chmod(0o600);saved.append({'source':str(source),'backup':str(destination)})
    (args.backup_dir/'manifest.json').write_text(json.dumps(saved,indent=2));(args.backup_dir/'manifest.json').chmod(0o600)
    result['backup']=str(args.backup_dir);print(json.dumps(result))
if __name__=='__main__':main()
