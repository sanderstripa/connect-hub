import unittest,urllib.error
from release import API,resolve

def item(tag,**extra):
    return dict(tag_name=tag,draft=False,assets=[{'name':'SHA256SUMS'},{'name':'connect-hub-linux-amd64.tar.gz'}],**extra)

class ReleaseSelection(unittest.TestCase):
    def test_new_alpha_without_rebuilding_old_updater(self):
        published=[item('v0.1.0-alpha.4')]
        def fetch(url):
            if url.endswith('/latest'):raise urllib.error.HTTPError(url,404,'No stable release',{},None)
            return published
        self.assertEqual(resolve(fetch=fetch),'v0.1.0-alpha.4')
        published.insert(0,item('v0.1.0-alpha.5'))
        self.assertEqual(resolve(fetch=fetch),'v0.1.0-alpha.5')

    def test_skip_draft_partial_upload_and_unrelated_tag(self):
        entries=[{**item('v99.0.0'),'draft':True},{**item('v8.0.0'),'assets':[]},item('not-a-version'),item('v0.1.0-alpha.7')]
        def fetch(url):
            if url.endswith('/latest'):raise urllib.error.HTTPError(url,404,'No stable release',{},None)
            return entries
        self.assertEqual(resolve(fetch=fetch),'v0.1.0-alpha.7')

    def test_stable_and_explicit_target(self):
        self.assertEqual(resolve(fetch=lambda url:item('v1.0.0')),'v1.0.0')
        urls=[]
        def fetch(url):urls.append(url);return item('v0.1.0-alpha.5')
        self.assertEqual(resolve(tag='v0.1.0-alpha.5',fetch=fetch),'v0.1.0-alpha.5')
        self.assertEqual(urls,[API+'/tags/v0.1.0-alpha.5'])

    def test_network_failure_does_not_install_an_old_fallback(self):
        def fetch(url):raise urllib.error.HTTPError(url,503,'Unavailable',{},None)
        with self.assertRaises(urllib.error.HTTPError):resolve(fetch=fetch)

    def test_invalid_explicit_tag_is_rejected_before_network(self):
        with self.assertRaises(ValueError):resolve(tag='../../other/repo',fetch=lambda url:self.fail(url))

if __name__=='__main__':unittest.main()
