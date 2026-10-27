import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('tls_preflight',Path(__file__).with_name('tls-preflight.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class TlsPreflightTests(unittest.TestCase):
 def dump(self,text):return '# configuration file /etc/nginx/sites-enabled/justisolve.conf:\n'+text
 def test_exact_apex_and_www_preserve_existing_proxy_config(self):
  result=module.inspect_dump(self.dump('server { listen 80; server_name justisolve.com www.justisolve.com; location / {proxy_pass http://127.0.0.1:18082;} } server {listen 443 ssl; server_name justisolve.com www.justisolve.com;}'))
  self.assertEqual(result['names'],['justisolve.com','www.justisolve.com']);self.assertEqual(len(result['configuration_files']),1)
 def test_missing_hostname_does_not_guess_a_backend(self):
  with self.assertRaisesRegex(ValueError,'No exact'):module.inspect_dump(self.dump('server {server_name other.example;}'))
 def test_shared_names_and_conflicting_server_blocks_are_rejected(self):
  with self.assertRaisesRegex(ValueError,'shares'):module.inspect_dump(self.dump('server {server_name justisolve.com other.example;}'))
  with self.assertRaisesRegex(ValueError,'Conflicting'):module.inspect_dump(self.dump('server {server_name justisolve.com;}'),'nginx: [warn] conflicting server name "justisolve.com" on 0.0.0.0:443, ignored')
 def test_comments_and_quoted_values_do_not_create_phantom_hosts(self):
  result=module.inspect_dump(self.dump('# server_name other.example;\nserver { add_header Example "server_name fake.example; { }"; server_name "justisolve.com"; # www.justisolve.com\n}'))
  self.assertEqual(result['names'],['justisolve.com'])
 def test_other_virtual_hosts_in_same_file_are_not_certificate_targets(self):
  result=module.inspect_dump(self.dump('server {server_name other.example;} server {server_name justisolve.com;}'))
  self.assertEqual(result['names'],['justisolve.com'])
if __name__=='__main__':unittest.main()
