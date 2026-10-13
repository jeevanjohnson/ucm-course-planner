import tempfile
import unittest
from unittest.mock import patch
from planner.course_details import parse_detail
from planner.providers import OfficialProvider, DemoProvider
from planner.service import SnapshotService

class DetailTests(unittest.TestCase):
    def test_description_entities_and_inert_content(self):
        data=parse_detail('<section aria-labelledby="courseDescription">Algebra &amp; analysis.<br>Applications.<script>bad()</script></section>','courseDescription')
        self.assertEqual(data['text'],'Algebra & analysis.\nApplications.')
        self.assertEqual(data['tables'],[])

    def test_prerequisite_logic_grade_and_empty_cells_preserved(self):
        raw='''<section aria-labelledby="preReqs"><h3>Catalog Prerequisites</h3><table>
        <tr><th>And/Or</th><th></th><th>Course</th><th>Grade</th><th></th></tr>
        <tr><td></td><td>(</td><td>MATH 023</td><td>C-</td><td></td></tr>
        <tr><td>Or</td><td></td><td>MATH 023H</td><td>C-</td><td>)</td></tr>
        <tr><td>And</td><td>(</td><td>MATH 024</td><td>C-</td><td>)</td></tr></table></section>'''
        table=parse_detail(raw,'preReqs')['tables'][0]
        self.assertEqual(table['headers'],['And/Or','','Course','Grade',''])
        self.assertEqual(table['rows'],[['','(','MATH 023','C-',''],['Or','','MATH 023H','C-',')'],['And','(','MATH 024','C-',')']])

    def test_headerless_table_does_not_lose_first_requirement(self):
        data=parse_detail('<section aria-labelledby="coReqs"><table><tr><td>MATH 1</td></tr></table></section>','coReqs')
        self.assertEqual(data['tables'][0],{'headers':[],'rows':[['MATH 1']]})

    def test_missing_information_is_not_treated_as_no_prerequisites(self):
        data=parse_detail('<section aria-labelledby="preReqs">No prerequisite information available.</section>','preReqs')
        self.assertEqual(data['text'],'No prerequisite information available.')

    def test_login_unexpected_and_truncated_fragments_rejected(self):
        for raw in ['<html>Sign in</html>','<section aria-labelledby="wrong">none</section>','<section aria-labelledby="preReqs"><table>']:
            with self.assertRaises(ValueError):parse_detail(raw,'preReqs')

    def test_provider_uses_requested_term_and_crn_for_all_detail_tabs(self):
        p=OfficialProvider()
        responses=[f'<section aria-labelledby="{name}">Sample</section>'.encode() for name in ['courseDescription','preReqs','coReqs','restrictions']]
        with patch.object(p,'request',side_effect=responses) as request:
            data=p.details('123456','12345')
            self.assertEqual(len(data),4)
            for call in request.call_args_list:self.assertEqual(call.args[2],{'term':'123456','courseReferenceNumber':'12345'})

    def test_details_and_linked_caches_are_separate_and_survive_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            p=DemoProvider();svc=SnapshotService({'demo':p},folder)
            details=svc.get('demo','demo','DEMO-1','details')
            linked=svc.get('demo','demo','DEMO-1')
            self.assertIn('text',details['data'][0]);self.assertIsInstance(linked['data'][0],list)
            with patch.object(p,'details',side_effect=AssertionError('cache expected')):
                self.assertEqual(SnapshotService({'demo':p},folder).get('demo','demo','DEMO-1','details')['data'],details['data'])
