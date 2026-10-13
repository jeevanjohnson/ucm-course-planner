import json
import tempfile
import unittest
import urllib.error
from email.message import Message
from unittest.mock import patch
from planner.models import normalize
from planner.providers import OfficialProvider, DemoProvider, ProviderError
from planner.service import SnapshotService

class ProviderTests(unittest.TestCase):
    def test_missing_meetings_and_unknown_availability(self):
        row=normalize({'term':'123456','courseReferenceNumber':'1','courseTitle':'Arts &amp; Science','faculty':[], 'meetingsFaculty':[]})
        self.assertEqual(row['meetings'],[])
        self.assertIsNone(row['availability']['seats'])
        self.assertIsNone(row['units'])
        self.assertEqual(row['title'],'Arts & Science')

    def test_multiple_meetings_and_instructors(self):
        row=normalize({'term':'123456','courseReferenceNumber':'1','faculty':[{'displayName':'A'}],
            'meetingsFaculty':[{'faculty':[{'displayName':'B'}], 'meetingTime':{'monday':True,'wednesday':True,'beginTime':'0930','endTime':'1045','startDate':'01/19/2027','endDate':'05/07/2027','meetingTypeDescription':'Lecture'}},
            {'meetingTime':{'friday':True,'beginTime':'1800','endTime':'2100','startDate':'05/14/2027','endDate':'05/14/2027','meetingTypeDescription':'Exam'}}]})
        self.assertEqual(row['instructors'],['A','B'])
        self.assertEqual(row['meetings'][0]['start'],570)
        self.assertEqual(row['meetings'][0]['days'],[0,2])
        self.assertEqual(row['meetings'][1]['startDate'],'2027-05-14')

    def test_pagination_and_term_isolation(self):
        provider=OfficialProvider()
        pages=[b'',{}, {'success':True,'totalCount':2,'data':[{'term':'123456','courseReferenceNumber':'1'}]},
            {'success':True,'totalCount':2,'data':[{'term':'123456','courseReferenceNumber':'2'}]}]
        with patch.object(provider,'request',side_effect=pages) as request:
            self.assertEqual(len(provider.courses('123456')),2)
            self.assertEqual(request.call_args.args[2]['pageOffset'],1)
        with patch.object(provider,'request',side_effect=[b'',{}, {'success':True,'totalCount':1,'data':[{'term':'OTHER','courseReferenceNumber':'1'}]}]):
            with self.assertRaisesRegex(ProviderError,'different semester'):provider.courses('123456')

    def test_incomplete_snapshot_rejected(self):
        provider=OfficialProvider()
        with patch.object(provider,'request',side_effect=[b'',{}, {'success':True,'totalCount':2,'data':[]}]):
            with self.assertRaisesRegex(ProviderError,'incomplete'):provider.courses('123456')

    def test_fixed_credit_fallback(self):
        row=normalize({'term':'123456','courseReferenceNumber':'1','creditHours':None,'creditHourLow':3,'creditHourHigh':None})
        self.assertEqual(row['units'],3)

    def test_linked_combinations_preserve_all_companions(self):
        provider=OfficialProvider()
        row=lambda crn: {'term':'123456','courseReferenceNumber':crn,'maximumEnrollment':30}
        with patch.object(provider,'request',return_value={'linkedData':[[row('2'),row('3')],[row('4'),row('5')]]}):
            result=provider.linked('123456','1')
        self.assertEqual([[c['id'] for c in group] for group in result],[['2','3'],['4','5']])
        self.assertNotIn('availability',result[0][0])

    def test_linked_invalid_or_wrong_term_rejected(self):
        provider=OfficialProvider()
        for response in ({}, {'linkedData':[[]]}, {'linkedData':[[{'term':'other','courseReferenceNumber':'2'}]]}):
            with patch.object(provider,'request',return_value=response):
                with self.assertRaises(ProviderError):provider.linked('123456','1')

    def test_rate_limit_respected_without_retrying(self):
        provider=OfficialProvider()
        session=provider.session()
        headers=Message();headers['Retry-After']='1800'
        exc=urllib.error.HTTPError('https://example.invalid',429,'Rate limited',headers,None)
        with patch.object(session[0],'open',side_effect=exc) as request:
            with self.assertRaises(ProviderError) as caught:provider.request(session,'/ssb/courseSearch/getTerms')
            self.assertEqual(caught.exception.retry_after,1800)
            with self.assertRaisesRegex(ProviderError,'cooldown'):provider.request(session,'/ssb/courseSearch/getTerms')
            self.assertEqual(request.call_count,1)

class CacheTests(unittest.TestCase):
    def test_linked_cache_separates_terms_sections_and_source(self):
        with tempfile.TemporaryDirectory() as folder:
            p=DemoProvider();svc=SnapshotService({'demo':p},folder)
            with patch.object(p,'linked',wraps=p.linked) as call:
                first=svc.get('demo','demo','DEMO-1')
                svc.get('demo','demo','DEMO-1')
                reverse=svc.get('demo','demo','DEMO-3')
                self.assertEqual(call.call_count,2)
                self.assertEqual(first['data'][0][0]['id'],'DEMO-3')
                self.assertEqual(reverse['data'][0][0]['id'],'DEMO-1')
    def test_cache_stale_retention_and_failure_backoff(self):
        with tempfile.TemporaryDirectory() as folder:
            p=DemoProvider();svc=SnapshotService({'demo':p},folder)
            with patch.object(p,'courses',wraps=p.courses) as call:
                first=svc.get('demo','demo');again=svc.get('demo','demo')
                self.assertEqual(first['data'],again['data']);self.assertEqual(call.call_count,1)
            svc.cache['demo-demo']['timestamp']=0
            with patch.object(p,'courses',side_effect=ProviderError('outage',90)) as call:
                old=svc.get('demo','demo');old2=svc.get('demo','demo')
                self.assertTrue(old['stale']);self.assertEqual(old['data'],first['data']);self.assertEqual(call.call_count,1)
                self.assertGreater(old2['retryAfter'],0)

    def test_restart_reuses_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            first=SnapshotService({'demo':DemoProvider()},folder).get('demo','demo')
            p=DemoProvider()
            with patch.object(p,'courses',side_effect=AssertionError('must use cache')):
                self.assertEqual(SnapshotService({'demo':p},folder).get('demo','demo')['data'],first['data'])

    def test_cold_failure_is_not_demo_fallback(self):
        with tempfile.TemporaryDirectory() as folder:
            p=OfficialProvider()
            with patch.object(p,'courses',side_effect=ProviderError('offline')):
                with self.assertRaisesRegex(ProviderError,'offline'):SnapshotService({'live':p},folder).get('live','123456')

if __name__=='__main__':unittest.main()
