'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { zipSync, strToU8 } = require('fflate');
const BASE = (process.env.JOBPILOT_URL || 'https://jobpilot-ai-topaz.vercel.app').replace(/\/+$/, '');
const checks = [];
const failures = [];
let browser, context, page;
const consoleErrors = [], pageErrors = [], requestFailures = [], badResponses = [];
function check(name, ok, detail) {
  checks.push({name, ok: !!ok, detail});
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : ' — ' + String(detail)));
  if (!ok) failures.push(name + (detail ? ': ' + detail : ''));
}
function expect(ok, name, detail) {
  check(name, ok, detail);
  if (!ok) throw new Error(name + (detail ? ': ' + detail : ''));
}
async function clickButton(re) {
  const el = page.getByRole('button', {name: re}).first();
  await el.waitFor({state:'visible', timeout:15000});
  await el.click();
}
async function fillPh(value, placeholder) {
  const el = page.locator('input[placeholder="' + placeholder.replace(/"/g, '\\"') + '"], textarea[placeholder="' + placeholder.replace(/"/g, '\\"') + '"]').first();
  await el.waitFor({state:'visible', timeout:10000});
  await el.fill(value);
}
async function openTab(buttonName, tabHeading) {
  await clickButton(new RegExp(buttonName, 'i'));
  await page.locator('.lower h2').filter({hasText:tabHeading}).waitFor({state:'visible',timeout:12000});
}
function pdfEsc(s) { return String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7e]/g,' '); }
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}
function makePng() {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2,0); header.writeUInt32BE(2,4);
  header[8]=8; header[9]=6; header[10]=0; header[11]=0; header[12]=0;
  const scanline = Buffer.from([0,255,40,40,255,0,180,255,255,0,255,40,40,255,0,180,255,255]);
  return Buffer.concat([signature,pngChunk('IHDR',header),pngChunk('IDAT',require('node:zlib').deflateSync(scanline)),pngChunk('IEND',Buffer.alloc(0))]);
}
function xmlEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function docxFile(lines) {
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="'+ns+'"><w:body>'+
    lines.map(line=>'<w:p><w:r><w:t xml:space="preserve">'+xmlEsc(line)+'</w:t></w:r></w:p>').join('')+
    '<w:sectPr/></w:body></w:document>';
  return Buffer.from(zipSync({'word/document.xml':strToU8(xml)}));
}
function textPdf(lines) {
  let y=760; const linesPdf=['BT','/F1 11 Tf'];
  for (const line of lines) { linesPdf.push('1 0 0 1 45 '+y+' Tm ('+pdfEsc(line)+') Tj'); y-=20; }
  linesPdf.push('ET'); const stream=linesPdf.join('\n')+'\n';
  const objects=[
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    '5 0 obj << /Length '+Buffer.byteLength(stream,'binary')+' >> stream\n'+stream+'endstream endobj'
  ];
  let pdf='%PDF-1.4\n'; const offsets=[0];
  for (const obj of objects) { offsets.push(Buffer.byteLength(pdf,'binary')); pdf+=obj+'\n'; }
  const xref=Buffer.byteLength(pdf,'binary');
  pdf+='xref\n0 6\n0000000000 65535 f \n';
  for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return Buffer.from(pdf,'binary');
}
function d(days) { const x=new Date(); x.setDate(x.getDate()+days); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
async function apiChecks() {
  for(const track of ['javaAngular','leadAngular']) {
    const res=await page.request.get(BASE+'/api/jobs?track='+track,{timeout:30000});
    const data=await res.json().catch(()=>null);
    expect(res.status()===200,'API HTTP status '+track,res.status());
    expect(data && data.track===track,'API returns requested track '+track);
    expect(data && Array.isArray(data.jobs),'API job array '+track);
    expect(data && Array.isArray(data.sources) && data.sources.length>0 && data.sources.every(source=>['Jobicy','RemoteOK'].includes(source)) && data.sources.every(source=>String(data.source||'').includes(source)) && Array.isArray(data.sourceWarnings),'API source provenance and warning transparency '+track);
    const invalid=(data.jobs||[]).find(j=>!j.title||!j.company||!/^https?:\/\//i.test(j.url||''));
    expect(!invalid,'API job fields and HTTP(S) URLs '+track, invalid?JSON.stringify(invalid):(data.jobs||[]).length+' listing(s)');
    const entryLevel=(data.jobs||[]).filter(job=>/\b(?:intern(?:ship)?|trainee|apprentice|graduate trainee|entry[- ]level|junior)\b/i.test(String(job.title||''))&&!/\b(?:senior|lead|principal|staff|architect|manager)\b/i.test(String(job.title||'')));
    expect(entryLevel.length===0,'API excludes trainee/junior listings',entryLevel.map(job=>job.title).join(', '));
  }
  const worker=await page.request.get(BASE+'/assets/pdf.worker.min.mjs',{timeout:20000});
  expect(worker.status()===200,'PDF.js worker static asset is deployed',worker.status());
  expect(/javascript|ecmascript|octet-stream/i.test(worker.headers()['content-type']||''),'PDF.js worker has JavaScript-compatible content type',worker.headers()['content-type']||'missing');
  const bad=await page.request.get(BASE+'/api/jobs?track=other',{timeout:20000});
  expect(bad.status()===400,'API rejects unknown career track',bad.status());
  const post=await page.request.post(BASE+'/api/jobs?track=javaAngular',{timeout:20000}).catch(()=>null);
  expect(post && post.status()===405,'API rejects non-GET request',post?post.status():'request failed');
}
async function run() {
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  page=await context.newPage(); page.setDefaultTimeout(12000);

  page.on('console',m=>{if(m.type()==='error'){consoleErrors.push(m.text());console.error('BROWSER_CONSOLE_ERROR '+m.text());}});
  page.on('pageerror',e=>{pageErrors.push(String(e));console.error('BROWSER_PAGE_ERROR '+String(e));});
  page.on('requestfailed',r=>{const message=r.method()+' '+r.url()+' :: '+(r.failure()?.errorText||'failed');requestFailures.push(message);console.error('BROWSER_REQUEST_FAILED '+message);});
  page.on('response',r=>{if(r.status()>=400)badResponses.push(r.status()+' '+r.url());});
  const response=await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  expect(response && response.status()===200,'Live dashboard returns HTTP 200',response && response.status());
  await page.waitForTimeout(8000);
  const initialDiagnostics=await page.evaluate(()=>({
    url:location.href,title:document.title,body:(document.body?.innerText||'').slice(0,1800),
    root:document.querySelector('app-root')?.innerHTML?.slice(0,1200)||null,
    scripts:Array.from(document.scripts).map(s=>({src:s.src,type:s.type,ready:s.readyState||''})),
    angularNodes:document.querySelectorAll('app-root > *').length
  })).catch(e=>({diagnosticError:String(e)}));
  const mainHeading=await page.getByRole('heading',{name:/Good to see you, Rohit/i}).isVisible().catch(()=>false);
  check('Frontend render diagnostics',mainHeading,JSON.stringify({page:initialDiagnostics,consoleErrors,pageErrors,requestFailures,badResponses}).slice(0,7000));
  expect(mainHeading,'Dashboard Angular root renders the main heading',JSON.stringify({title:initialDiagnostics.title,body:initialDiagnostics.body,consoleErrors,pageErrors,requestFailures,badResponses}).slice(0,5000));
  expect((await page.locator('body').innerText()).includes('Live submissions disabled'),'Safe mode is visible');
  expect((await page.locator('body').innerText()).includes('Safe mode: ON'),'Safe mode cannot be toggled off while portal submissions are disabled');
  expect(await page.getByRole('button',{name:'Review-only mode'}).isDisabled(),'Review-only mode is explicitly non-interactive');
  await page.evaluate(()=>{
    localStorage.clear();
    localStorage.setItem('jobpilot-profile',JSON.stringify({
      name:'Playwright Test Candidate',email:'test.candidate@example.com',phone:'+1 555 0100',
      title:'Full Stack Engineer',experience:'9+ years',java:'7 years',angular:'Not specified',
      notice:'Immediate joiner',location:'Remote / India',workMode:'Remote',
      currentCtc:'28 LPA',expectedCtc:'32 LPA',
      targetRoles:'Java + Angular Full Stack; Lead Angular Developer',
      skills:'Java 17, Spring Boot 3, Angular 17, TypeScript, RxJS, REST APIs, Jasmine, Karma'
    }));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await apiChecks();

  await openTab('Job discovery','Jobs');
  await clickButton(/Discover both tracks in parallel/i);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.lower .save-msg')).some(el=>
    /Java \+ Angular:\s*\d+ recent remote matches/.test(el.textContent||'') &&
    /Lead Angular:\s*\d+ recent remote matches/.test(el.textContent||'')),null,{timeout:70000});
  const parallelMsg=await page.locator('.lower .save-msg').first().innerText();
  expect(/Java \+ Angular:\s*\d+ recent remote matches/.test(parallelMsg),'Parallel flow reports Java track',parallelMsg);
  expect(/Lead Angular:\s*\d+ recent remote matches/.test(parallelMsg),'Parallel flow reports Lead Angular track',parallelMsg);
  await openTab('Settings','Local AI settings');
  expect((await page.locator('body').innerText()).includes('Check local Ollama'),'Local Ollama connection check is available in Settings');
  await openTab('Job discovery','Jobs');
  if(await page.locator('.job-card').count()>0) {
    await clickButton(/Tailor resume for this job/i);
    await page.locator('.lower h2').filter({hasText:'Resume studio'}).waitFor({state:'visible'});
    expect(true,'Discovered job can prefill Resume Studio');
  } else await openTab('Resume studio','Resume studio');
  expect((await page.locator('body').innerText()).includes('Generate AI-tailored resume (Ollama)'),'Local Ollama resume tailoring control is visible');

  const jr='Java + Angular Full Stack Engineer E2E';
  const jc='E2E Java Track Company';
  const jd='Requirements: Java 17, Spring Boot 3, Angular, TypeScript, REST APIs and microservices. Kubernetes experience is preferred.';
  await page.locator('.lower select').first().selectOption('javaAngular');
  await fillPh(jr,'Exact role title from vacancy'); await fillPh(jc,'Company name');
  await fillPh(jd,'Paste the job description. The resume generator emphasizes skills already present in your verified profile; it does not invent missing experience.');
  await fillPh('https://example.com/jobs/java-angular-e2e','https://...');
  await fillPh('hr.java.test@example.com','From the job post or company site');
  await fillPh('Jane Test','Recruiter / hiring manager');

  const lr='Lead Angular Developer E2E';
  const lc='E2E Lead Angular Company';
  const ld='Requirements: Angular 17, TypeScript, RxJS, reusable components, Jasmine, Karma and front-end leadership.';
  await page.locator('.lower select').first().selectOption('leadAngular');
  await fillPh(lr,'Exact role title from vacancy'); await fillPh(lc,'Company name');
  await fillPh(ld,'Paste the job description. The resume generator emphasizes skills already present in your verified profile; it does not invent missing experience.');
  await fillPh('https://example.com/jobs/lead-angular-e2e','https://...');
  await fillPh('hr.angular.test@example.com','From the job post or company site');
  await fillPh('Alex Test','Recruiter / hiring manager');

  const leadLines=['Playwright Test Candidate','Professional Summary','Angular lead and full-stack engineer with a background in modern web applications.','Core Skills','Angular 17, TypeScript, RxJS, Jasmine, Karma, HTML, CSS, REST APIs','Professional Experience','Angular Team Lead - Lead Resume Test','Led Angular 17 delivery, reusable components, code reviews and mentoring.','Education','Bachelor of Technology - Computer Science','Languages','English, Hindi'];
  const javaLines=['Playwright Test Candidate','Professional Summary','Senior Java and Angular full-stack engineer delivering enterprise applications.','Core Skills','Java 17, Spring Boot 3, Angular, TypeScript, REST APIs, microservices, Kafka','Professional Experience','Technical Lead - Java Resume Test','Built Spring Boot services and Angular user experiences.','Education','Bachelor of Technology - Computer Science','Languages','English, Hindi'];
  await page.locator('label:has-text("Master resume — Lead Angular") input[type="file"]').setInputFiles({name:'Lead_Angular_Master_E2E.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:docxFile(leadLines)});
  await page.waitForFunction(()=>{const label=Array.from(document.querySelectorAll('label')).find(el=>el.innerText.includes('Master resume — Lead Angular'));const msg=Array.from(document.querySelectorAll('.lower .save-msg')).map(el=>el.innerText).join(' ');return !!(label&&label.innerText.includes('Lead_Angular_Master_E2E.docx'))||/Could not save master resume|Browser storage .*within 8 seconds|storage transaction failed/i.test(msg);},null,{timeout:12000});
  const leadLabelText=await page.locator('label:has-text("Master resume — Lead Angular")').innerText();
  const leadStatus=await page.locator('.lower .save-msg').first().innerText();
  expect(leadLabelText.includes('Lead_Angular_Master_E2E.docx'),'Lead master file stored in browser',JSON.stringify({label:leadLabelText,status:leadStatus}));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('label')).some(el=>el.innerText.includes('Master resume — Lead Angular')&&/[1-9]\d* characters extracted locally/.test(el.innerText))||/text extraction failed|little\/no text/i.test(Array.from(document.querySelectorAll('.lower .save-msg')).map(el=>el.innerText).join(' ')),null,{timeout:16000});
  const leadStatusAfter=await page.locator('.lower .save-msg').first().innerText();
  const leadLabelAfter=await page.locator('label:has-text("Master resume — Lead Angular")').innerText();
  expect(/[1-9]\d* characters extracted locally/.test(leadLabelAfter),'Lead DOCX text extracted',JSON.stringify({label:leadLabelAfter,status:leadStatusAfter}));
  await page.locator('.lower select').first().selectOption('javaAngular');
  expect(await page.locator('input[placeholder="Exact role title from vacancy"]').inputValue()===jr,'Java role is restored after track switch');
  expect(await page.locator('input[placeholder="Company name"]').inputValue()===jc,'Java company is restored after track switch');
  expect(await page.locator('textarea[placeholder^="Paste the job description"]').inputValue()===jd,'Java job description persists per track');
  await page.locator('label:has-text("Master resume — Java + Angular") input[type="file"]').setInputFiles({name:'Java_Angular_Master_E2E.pdf',mimeType:'application/pdf',buffer:textPdf(javaLines)});
  await page.waitForFunction(()=>{const label=Array.from(document.querySelectorAll('label')).find(el=>el.innerText.includes('Master resume — Java + Angular'));const msg=Array.from(document.querySelectorAll('.lower .save-msg')).map(el=>el.innerText).join(' ');return !!(label&&label.innerText.includes('Java_Angular_Master_E2E.pdf'))||/Could not save master resume|Browser storage .*within 8 seconds|storage transaction failed/i.test(msg);},null,{timeout:12000});
  const javaLabelText=await page.locator('label:has-text("Master resume — Java + Angular")').innerText();
  const javaStatus=await page.locator('.lower .save-msg').first().innerText();
  expect(javaLabelText.includes('Java_Angular_Master_E2E.pdf'),'Java master file stored in browser',JSON.stringify({label:javaLabelText,status:javaStatus}));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('label')).some(el=>el.innerText.includes('Master resume — Java + Angular')&&/[1-9]\d* characters extracted locally/.test(el.innerText))||/PDF text extraction failed|little\/no text/i.test(Array.from(document.querySelectorAll('.lower .save-msg')).map(el=>el.innerText).join(' ')),null,{timeout:16000});
  const javaStatusAfter=await page.locator('.lower .save-msg').first().innerText();
  const javaLabelAfter=await page.locator('label:has-text("Master resume — Java + Angular")').innerText();
  expect(/[1-9]\d* characters extracted locally/.test(javaLabelAfter),'Java PDF text extracted',JSON.stringify({label:javaLabelAfter,status:javaStatusAfter}));

  await clickButton(/Generate tailored resume/i);
  await page.getByText(/Upload your professional photo first/i).waitFor({state:'visible',timeout:8000});
  expect(true,'Resume generation blocks when photo is missing');
  const png=makePng();
  await page.locator('label:has-text("Your resume photo") input[type="file"]').setInputFiles({name:'test-photo.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('label')).some(el=>el.innerText.includes('Your resume photo')&&el.innerText.includes('test-photo.png')),null,{timeout:10000});
  expect((await page.locator('label:has-text("Your resume photo")').innerText()).includes('test-photo.png'),'Photo selected and reflected in form');
  await page.waitForFunction(()=>/Photo saved locally and will be embedded|Photo is selected for this session, but could not be saved/i.test(Array.from(document.querySelectorAll('.save-msg')).map(el=>el.innerText).join(' ')),null,{timeout:10000});
  const javaDownloadPromise=page.waitForEvent('download',{timeout:20000});
  await clickButton(/Generate tailored resume/i);
  const javaDownload=await javaDownloadPromise, javaPath=await javaDownload.path();
  const javaHtml=await fs.readFile(javaPath,'utf8');
  expect(javaHtml.includes(jr),'Java resume contains target designation');
  expect(javaHtml.includes('data:image/png;base64,'),'Photo embedded in Java resume');
  expect(javaHtml.includes('grid-template-columns:100px 1fr'),'Photo sits in left/top column');
  expect(javaHtml.includes('Technical Lead - Java Resume Test'),'Java resume uses extracted experience');
  expect(javaHtml.includes('Bachelor of Technology - Computer Science'),'Java resume uses extracted education');
  expect(javaHtml.includes('Senior Java and Angular full-stack engineer'),'Java resume uses source summary');
  expect(!javaHtml.includes('Kubernetes'),'Resume excludes job-description skills absent from the verified profile and master resume');
  expect(!javaHtml.includes('undefined'),'Java resume contains no undefined placeholder');

  await page.evaluate(() => {
    const originalFetch=window.fetch.bind(window);
    window.fetch=async (input, init) => {
      const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
      if(url==='http://localhost:11434/api/chat') {
        const content=JSON.stringify({summary:'AI local test summary: verified Java and Angular enterprise delivery.',skills:['Java 17','Spring Boot 3','Angular','Kubernetes']});
        return new Response(JSON.stringify({message:{content}}),{status:200,headers:{'content-type':'application/json'}});
      }
      return originalFetch(input,init);
    };
  });
  const aiDownloadPromise=page.waitForEvent('download',{timeout:20000});
  await clickButton(/Generate AI-tailored resume \(Ollama\)/i);
  const aiDownload=await aiDownloadPromise;
  const aiHtml=await fs.readFile(await aiDownload.path(),'utf8');
  expect(aiHtml.includes('AI local test summary'),'Local Ollama response is used in the tailored resume');
  expect(!aiHtml.includes('Kubernetes'),'AI-selected skills not present in the verified candidate sources are rejected');


  const preview=await context.newPage();
  await preview.setContent(javaHtml,{waitUntil:'load'});
  await preview.locator('img.photo').waitFor({state:'visible',timeout:10000});
  await preview.waitForFunction(()=>document.querySelector('img.photo')&&document.querySelector('img.photo').naturalWidth>0,null,{timeout:10000});
  const photoBox=await preview.locator('img.photo').boundingBox(), nameBox=await preview.locator('h1.name').boundingBox();
  expect(photoBox&&nameBox&&photoBox.x<nameBox.x&&photoBox.y<=nameBox.y+15,'Rendered photo sits top-left beside the name');
  const pdf=await preview.pdf({format:'A4',printBackground:true});
  expect(pdf.slice(0,4).toString('ascii')==='%PDF','Resume exports to valid PDF bytes');
  const pdfPages=Number((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length);
  expect(pdfPages>=1,'PDF contains at least one page',pdfPages);
  await preview.close();

  await fillPh('not-an-email','From the job post or company site');
  await clickButton(/Prepare recruiter email/i);
  await page.getByText(/Enter a verified recruiter\/HR email/i).waitFor({state:'visible'});
  expect(true,'Email draft rejects malformed address');
  await fillPh('hr.java.test@example.com','From the job post or company site');
  await page.evaluate(()=>{window.__jobpilotOpenedUrl='';window.open=function(url){window.__jobpilotOpenedUrl=String(url);return null;};});
  await clickButton(/Prepare recruiter email/i);
  const composeUrl=await page.evaluate(()=>window.__jobpilotOpenedUrl);
  expect(composeUrl.startsWith('https://compose.mail.yahoo.com/'),'Valid email opens compose draft link');
  const compose=new URL(composeUrl);
  expect(compose.searchParams.get('to')==='hr.java.test@example.com','Draft has exact recipient');
  expect((compose.searchParams.get('subject')||'').includes(jr),'Draft subject contains target designation');
  expect((compose.searchParams.get('body')||'').includes('Playwright Test Candidate'),'Draft body contains candidate profile');
  expect((await page.locator('.lower .save-msg').innerText()).toLowerCase().includes('attach the generated pdf'),'Draft instructs user to attach PDF and send manually');

  await page.reload({waitUntil:'domcontentloaded'});
  await openTab('Resume studio','Resume studio');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('label')).some(el=>el.innerText.includes('Java_Angular_Master_E2E.pdf')&&el.innerText.includes('characters extracted locally')),null,{timeout:15000});
  expect((await page.locator('label:has-text("Master resume — Java + Angular")').innerText()).includes('Java_Angular_Master_E2E.pdf'),'Java master persists after reload');
  expect((await page.locator('label:has-text("Master resume — Lead Angular")').innerText()).includes('Lead_Angular_Master_E2E.docx'),'Lead master persists after reload');
  expect((await page.locator('label:has-text("Your resume photo")').innerText()).includes('test-photo.png'),'Photo persists after reload');
  expect(await page.locator('input[placeholder="Exact role title from vacancy"]').inputValue()===jr,'Active job draft persists after reload');
  await page.locator('.lower select').first().selectOption('leadAngular');
  expect(await page.locator('input[placeholder="Exact role title from vacancy"]').inputValue()===lr,'Lead Angular draft is independent');
  const leadDownloadPromise=page.waitForEvent('download',{timeout:20000});
  await clickButton(/Generate tailored resume/i);
  const leadDownload=await leadDownloadPromise;
  const leadHtml=await fs.readFile(await leadDownload.path(),'utf8');
  expect(leadHtml.includes(lr),'Lead Angular resume title is correct');
  expect(leadHtml.includes('Angular Team Lead - Lead Resume Test'),'Lead Angular resume uses its own master file');
  expect(leadHtml.includes('data:image/png;base64,'),'Lead Angular resume embeds photo');

  await openTab('Candidate profile','Profile');
  await page.locator('input[placeholder="Your full name"]').fill('Playwright Profile Persistence Test');
  await clickButton(/^Save profile$/i);
  await page.getByText(/Profile saved in this browser/i).waitFor({state:'visible'});
  await page.reload({waitUntil:'domcontentloaded'});
  await openTab('Candidate profile','Profile');
  expect(await page.locator('input[placeholder="Your full name"]').inputValue()==='Playwright Profile Persistence Test','Profile persists after reload');

  await openTab('Application tracker','Applications');
  await clickButton(/^Add to tracker$/i);
  await page.getByText('Company and role are required.',{exact:true}).waitFor({state:'visible'});
  expect(true,'Tracker rejects missing company or role');
  await fillPh('Unsafe URL Test Company','Company name');
  await fillPh('Unsafe URL Test Role','Java Technical Lead');
  await fillPh('javascript:alert(1)','https://...');
  await clickButton(/^Add to tracker$/i);
  await page.getByText(/valid HTTP or HTTPS URL/i).waitFor({state:'visible'});
  expect(await page.locator('.tracker-item').count()===0,'Tracker rejects unsafe javascript URL');
  await fillPh('E2E Duplicate Company','Company name');
  await fillPh('Senior Java + Angular Engineer','Java Technical Lead');
  await fillPh('https://example.com/jobs/e2e-duplicate','https://...');
  await page.locator('label:has-text("Follow-up date") input[type="date"]').fill(d(1));
  await clickButton(/^Add to tracker$/i);
  await page.getByText(/Vacancy added to this browser tracker as Saved/i).waitFor({state:'visible'});
  expect(await page.locator('.tracker-item').count()===1,'Tracker saves vacancy');
  let due=await page.locator('.stats article').filter({hasText:'FOLLOW-UPS DUE'}).locator('strong').innerText();
  expect(due.trim()==='1','Upcoming follow-up increments count');
  await fillPh('E2E Duplicate Company','Company name');
  await fillPh('Senior Java + Angular Engineer','Java Technical Lead');
  await fillPh('https://example.com/jobs/e2e-duplicate','https://...');
  await clickButton(/^Add to tracker$/i);
  await page.getByText(/This vacancy is already in your tracker/i).waitFor({state:'visible'});
  expect(await page.locator('.tracker-item').count()===1,'Tracker prevents duplicate URL');
  await fillPh('E2E Rejected Company','Company name');
  await fillPh('Rejected E2E Role','Java Technical Lead');
  await fillPh('','https://...');
  await page.locator('label:has-text("Follow-up date") input[type="date"]').fill(d(1));
  await page.locator('.lower select').nth(1).selectOption('Rejected');
  await clickButton(/^Add to tracker$/i);
  expect(await page.locator('.tracker-item').count()===2,'Tracker adds a distinct vacancy');
  due=await page.locator('.stats article').filter({hasText:'FOLLOW-UPS DUE'}).locator('strong').innerText();
  expect(due.trim()==='1','Rejected vacancy excluded from due count');
  await page.reload({waitUntil:'domcontentloaded'});
  await openTab('Application tracker','Applications');
  expect(await page.locator('.tracker-item').count()===2,'Tracker items survive reload');
  const saved=page.locator('.tracker-item').filter({hasText:'E2E Duplicate Company'}).first();
  await saved.getByRole('button',{name:/Draft follow-up/i}).click();
  const follow=await saved.locator('textarea[readonly]').inputValue();
  expect(follow.startsWith('Hello,'),'Follow-up uses generic greeting without contact');
  expect(follow.includes('saved vacancy'),'Follow-up wording reflects Saved status');
  await page.locator('.tracker-item').filter({hasText:'E2E Duplicate Company'}).getByRole('button',{name:'Remove'}).click();
  await page.locator('.tracker-item').filter({hasText:'E2E Rejected Company'}).getByRole('button',{name:'Remove'}).click();
  expect(await page.locator('.tracker-item').count()===0,'Test tracker items can be removed');

  // Malicious job URLs must never become active hyperlinks in a generated resume.
  await openTab('Resume studio','Resume studio');
  await page.locator('.lower select').first().selectOption('javaAngular');
  await fillPh('javascript:alert(1)','https://...');
  const unsafeResumePromise=page.waitForEvent('download',{timeout:20000});
  await clickButton(/Generate tailored resume/i);
  const unsafeResume=await unsafeResumePromise;
  const unsafeHtml=await fs.readFile(await unsafeResume.path(),'utf8');
  expect(!/href\s*=\s*["']\s*javascript:/i.test(unsafeHtml),'Resume generator strips javascript: posting hyperlinks');
  await fillPh('https://example.com/jobs/java-angular-e2e','https://...');

  // Naukri-first guided portal assistant: validate host, save as Saved, never Applied.
  await openTab('Portal assistant','Portal automation');
  await page.locator('.lower select').first().selectOption('Naukri');
  await fillPh('Java + Angular Full Stack Engineer E2E','Java + Angular Full Stack Developer');
  await fillPh('E2E Portal Company','Company from the vacancy');
  await fillPh('https://example.com/not-a-portal-job','Paste a job link from the selected portal');
  await clickButton(/Save to application tracker/i);
  expect((await page.locator('.lower .save-msg').first().innerText()).includes('Use a valid HTTPS URL from Naukri'),'Portal assistant rejects a non-Naukri URL');
  await fillPh('https://www.naukri.com/job-listings-e2e-test','Paste a job link from the selected portal');
  await clickButton(/Save to application tracker/i);
  expect((await page.locator('.lower .save-msg').first().innerText()).includes('Saved as Saved — not Applied'),'Portal assistant labels new vacancies Saved, not Applied');
  const savedPortal=await page.evaluate(()=>JSON.parse(localStorage.getItem('jobpilot-applications')||'[]').find((x)=>x.source==='Naukri'&&x.url==='https://www.naukri.com/job-listings-e2e-test'));
  expect(!!savedPortal&&savedPortal.status==='Saved','Naukri vacancy persists as Saved without claiming submission');
  await clickButton(/Prepare tailored resume/i);
  await page.locator('.lower h2').filter({hasText:'Resume studio'}).waitFor({state:'visible'});
  const handedOffDescription=await page.locator('textarea[placeholder^="Paste the job description"]').inputValue();
  expect(handedOffDescription==='','Portal handoff clears stale job description before resume tailoring');
  await openTab('Application tracker','Applications');
  const portalItem=page.locator('.tracker-item').filter({hasText:'Java + Angular Full Stack Engineer E2E'}).filter({hasText:'E2E Portal Company'});
  if(await portalItem.count()) await portalItem.first().getByRole('button',{name:'Remove'}).click();
  expect(!(await page.evaluate(()=>JSON.parse(localStorage.getItem('jobpilot-applications')||'[]').some((x)=>x.source==='Naukri'&&x.url==='https://www.naukri.com/job-listings-e2e-test'))),'Naukri portal test fixture can be removed from tracker');

  // Mobile layout regression check at a phone-sized viewport.
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  const widths=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  expect(widths.scroll<=widths.viewport+2,'Mobile viewport does not overflow horizontally',JSON.stringify(widths));

  check('No console errors',consoleErrors.length===0,consoleErrors.slice(0,8).join(' | '));
  check('No unhandled page errors',pageErrors.length===0,pageErrors.slice(0,8).join(' | '));
  if(consoleErrors.length||pageErrors.length) failures.push('Browser runtime errors detected');
  console.log('\nE2E SUMMARY: '+checks.filter(x=>x.ok).length+'/'+checks.length+' checks passed.');
  if(failures.length) throw new Error(failures.join('\n'));
}
run().catch(async err=>{
  console.error('\nE2E FAILURE:',err&&err.stack?err.stack:String(err));
  console.error('BROWSER_DIAGNOSTICS '+JSON.stringify({consoleErrors,pageErrors,requestFailures,body:page?await page.locator('body').innerText().catch(e=>'unavailable '+e):'page unavailable'}).slice(0,10000));
  try{if(page)await page.screenshot({path:'/tmp/jobpilot-e2e-failure.png',fullPage:true});}catch{}
  console.log('\nCHECK RESULTS:\n'+JSON.stringify(checks,null,2));
  process.exitCode=1;
}).finally(async()=>{if(browser)await browser.close();});
