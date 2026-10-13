"""Convert official detail fragments to inert text/tables without losing rule grouping."""
from html.parser import HTMLParser

class DetailParser(HTMLParser):
    def __init__(self, expected):
        super().__init__(convert_charrefs=True)
        self.expected=expected
        self.found=False
        self.depth=0
        self.skip=0
        self.text=[]
        self.tables=[]
        self.table=None
        self.row=None
        self.cell=None
        self.row_header=False

    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='section':
            if self.depth:
                self.depth+=1
            elif attrs.get('aria-labelledby')==self.expected:
                self.found=True
                self.depth=1
        if not self.depth:return
        if tag in ('script','style'):
            self.skip+=1
        if self.skip:return
        if tag=='table':self.table={'headers':[],'rows':[]}
        elif tag=='tr' and self.table is not None:
            self.row=[]
            self.row_header=False
        elif tag in ('td','th') and self.row is not None:
            self.cell=[]
            self.row_header=self.row_header or tag=='th'
        elif tag in ('br','p','div','h3','h4','li'):
            (self.cell if self.cell is not None else self.text).append('\n')

    def handle_data(self, data):
        if not self.depth or self.skip:return
        if self.cell is not None:self.cell.append(data)
        elif self.table is None:self.text.append(data)

    def handle_endtag(self, tag):
        if not self.depth:return
        if tag in ('script','style'):
            self.skip=max(0,self.skip-1)
            return
        if self.skip:return
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell=None
        elif tag=='tr' and self.row is not None:
            if self.row_header and not self.table['headers']:
                self.table['headers']=self.row
            elif self.row:
                self.table['rows'].append(self.row)
            self.row=None
        elif tag=='table' and self.table is not None:
            self.tables.append(self.table)
            self.table=None
        elif tag in ('p','div','h3','h4','li') and self.table is None:self.text.append('\n')
        if tag=='section':self.depth-=1

def parse_detail(raw, expected):
    parser=DetailParser(expected)
    parser.feed(raw.decode('utf-8') if isinstance(raw,bytes) else raw)
    parser.close()
    if not parser.found or parser.depth or parser.table is not None:
        raise ValueError('Unexpected official course detail response.')
    text='\n'.join(' '.join(line.split()) for line in ''.join(parser.text).splitlines() if line.strip())
    if not text and not parser.tables:
        text='The university did not provide information in this section.'
    return {'text':text,'tables':parser.tables}
