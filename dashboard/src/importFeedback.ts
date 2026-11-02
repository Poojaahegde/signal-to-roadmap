import type { Signal, Source } from './analysis';
export type IncomingSignal = Omit<Signal, 'id' | 'createdAt'>;
export type ImportTable = { headers: string[]; rows: string[][]; textColumn: number; sourceColumn: number; accountColumn: number; hasHeader: boolean; delimiter: string };
export const MAX_FILE_BYTES = 2_000_000;
export const MAX_IMPORT_ROWS = 2000;
const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const textHeaders = ['text','feedback','feedback text','customer feedback','message','message text','comment','comments','review','review text','quote','content','body','description','ticket description','signal','summary'];
export function sourceFrom(value: string, fallback: Source): Source {
  const s = value.trim().toLowerCase();
  return /support|ticket|conversation|complaint/.test(s) ? 'support' : /review|survey/.test(s) ? 'review' : /note|sales|interview|call/.test(s) ? 'note' : fallback;
}
function detectDelimiter(text: string): string {
  let quoted=false;const counts:Record<string,number>={',':0,';':0,'\t':0};
  for(let i=0;i<text.length;i++) { const c=text[i];if(c==='"') {if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}if(!quoted){if(c==='\n'||c==='\r')break;if(c in counts)counts[c]++;} }
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}
export function parseTable(raw: string, headerOverride?: boolean): ImportTable {
  const text=raw.replace(/^\uFEFF/,'');const delimiter=detectDelimiter(text);
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
  function endRow(){row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell='';closed=false;if(rows.length>MAX_IMPORT_ROWS+1)throw new Error(`This file has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows. Split it into smaller files.`);}
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c===delimiter){row.push(cell);cell='';closed=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();}
    else if(c==='"'&&!cell.trim()&&!closed){cell='';quoted=true;}
    else if(closed&&c.trim())throw new Error('A CSV row has unexpected text after a closing quote. Check the file and try again.');
    else if(!closed)cell+=c;
  }
  if(quoted)throw new Error('A CSV field has an unclosed quote. Close the quote and try again.');
  endRow();
  if(!rows.length)throw new Error('This file is empty. Add feedback text, then upload it again.');
  const first=rows[0].map(normalize);
  const textColumn=first.findIndex(s=>textHeaders.includes(s));
  const sourceColumn=first.findIndex(s=>['source','source type','type','channel'].includes(s));
  const accountColumn=first.findIndex(s=>['account','customer','company','customer name','account name'].includes(s));
  const detectedHeader=textColumn>=0||sourceColumn>=0||accountColumn>=0||first.some(s=>['id','date','created at','ticket id','customer id','category','rating'].includes(s));
  const hasHeader=headerOverride ?? detectedHeader;
  const data=rows.slice(hasHeader?1:0);
  if(!data.length)throw new Error('This file has column headings but no feedback rows.');
  if(data.length>MAX_IMPORT_ROWS)throw new Error(`Import up to ${MAX_IMPORT_ROWS.toLocaleString()} rows at a time. Split this file into smaller files.`);
  const width=Math.max(rows[0].length,...data.map(r=>r.length));
  return {headers:Array.from({length:width},(_,i)=>hasHeader?(rows[0][i]?.trim()||`Column ${i+1}`):`Column ${i+1}`),rows:data,textColumn:hasHeader&&textColumn>=0?textColumn:(width===1?0:-1),sourceColumn:hasHeader?sourceColumn:-1,accountColumn:hasHeader?accountColumn:-1,hasHeader,delimiter};
}
export function tableSignals(table: ImportTable, fallback: Source): { signals: IncomingSignal[]; blank: number } {
  if(table.textColumn<0)return {signals:[],blank:0};
  let blank=0;const signals:IncomingSignal[]=[];
  for(const row of table.rows){const text=(row[table.textColumn]||'').trim();if(!text){blank++;continue;}signals.push({text,source:sourceFrom(table.sourceColumn>=0?row[table.sourceColumn]||'':'',fallback),account:table.accountColumn>=0?row[table.accountColumn]?.trim()||undefined:undefined});}
  return {signals,blank};
}
export function partitionSignals(items: IncomingSignal[], existing: Signal[]) {
  const key=(s:IncomingSignal)=>JSON.stringify([s.source,(s.account||'').trim().toLowerCase(),s.text.trim().toLowerCase()]);
  const seen=new Set(existing.map(key));const unique:IncomingSignal[]=[];let duplicates=0;
  for(const item of items){if(seen.has(key(item))){duplicates++;continue;}seen.add(key(item));unique.push(item);}
  return {unique,duplicates};
}
export function decodeFeedback(buffer: ArrayBuffer): string {
  const b=new Uint8Array(buffer);
  if(b[0]===0xff&&b[1]===0xfe)return new TextDecoder('utf-16le').decode(b);
  if(b[0]===0xfe&&b[1]===0xff)return new TextDecoder('utf-16be').decode(b);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{throw new Error('The file is not readable UTF-8 text. Export it as CSV UTF-8 or plain text, then upload again.');}
}
