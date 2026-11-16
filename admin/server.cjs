const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { spawn } = require('node:child_process');
const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const PORT = 4178;
const HOST = '127.0.0.1';
const MAX_BODY = 4 * 1024 * 1024;
const uploads = path.join(ROOT, 'work', 'uploads');
fs.mkdirSync(uploads, { recursive: true });

function send(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function run(cmd, args, options = {}) { return execFileAsync(cmd, args, { cwd: ROOT, windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...options }); }
function body(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => { data += chunk; if (data.length > MAX_BODY) { reject(new Error('Тело запроса слишком велико')); req.destroy(); } }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Некорректный JSON')); } }); req.on('error', reject); }); }
function safeId(id) { return /^[a-z0-9][a-z0-9-]{1,59}$/.test(id); }
function safeMediaPath(value, folder) { return typeof value === 'string' && new RegExp(`^/${folder}/[a-z0-9][a-z0-9._-]{0,159}\\.(?:svg|png|jpe?g|webp)$`, 'i').test(value) && fs.existsSync(path.join(ROOT, 'public', value.slice(1))) && fs.statSync(path.join(ROOT, 'public', value.slice(1))).isFile(); }
function parseMultipart(req, maxBytes = 700 * 1024 * 1024, limitMessage = 'Файл превышает допустимый размер') { return new Promise((resolve, reject) => {
  const chunks = []; let size = 0; req.on('data', chunk => { size += chunk.length; if (size > maxBytes) { reject(new Error(limitMessage)); req.destroy(); return; } chunks.push(chunk); });
  req.on('end', () => { try { const raw = Buffer.concat(chunks); const type = req.headers['content-type'] || ''; const boundary = type.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean); if (!boundary) throw Error('Не найден multipart boundary'); const marker = Buffer.from(`--${boundary}`); let pos = raw.indexOf(marker) + marker.length; const fields = {}, files = {};
    while (pos >= marker.length) { if (raw.subarray(pos, pos + 2).equals(Buffer.from('--'))) break; if (raw.subarray(pos, pos + 2).equals(Buffer.from('\r\n'))) pos += 2; const endHeaders = raw.indexOf(Buffer.from('\r\n\r\n'), pos); if (endHeaders < 0) break; const headers = raw.subarray(pos, endHeaders).toString(); const next = raw.indexOf(marker, endHeaders + 4); if (next < 0) break; let contentEnd = next - 2; const disposition = headers.match(/content-disposition:\s*form-data;[^\r\n]*/i)?.[0] || ''; const name = disposition.match(/name="([^"]+)"/)?.[1]; const filename = disposition.match(/filename="([^"]*)"/)?.[1]; const content = raw.subarray(endHeaders + 4, contentEnd); if (filename !== undefined && name) { const entry = { name: path.basename(filename), content: Buffer.from(content) }; if (!files[name]) files[name] = entry; else if (Array.isArray(files[name])) files[name].push(entry); else files[name] = [files[name], entry]; } else if (name) fields[name] = content.toString('utf8'); pos = next + marker.length; }
    resolve({ fields, files }); } catch (e) { reject(e); } }); req.on('error', reject); }); }

async function handler(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method !== 'GET' && req.headers.origin && !['http://127.0.0.1:4178','http://localhost:4178'].includes(req.headers.origin)) return send(res, 403, { error: 'Запрос разрешён только из локальной панели.' });
  try {
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const [git, gh] = await Promise.allSettled([run('git', ['--version']), run('gh', ['--version'])]);
      let auth = false, repo = '', user = '';
      if (gh.status === 'fulfilled') { try { const r = await run('gh', ['auth', 'status']); auth = true; user = (r.stderr || r.stdout).split('\n')[0].trim(); } catch { auth = false; } try { repo = (await run('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])).stdout.trim(); } catch { repo = ''; } }
      send(res, 200, { git: git.status === 'fulfilled', gh: gh.status === 'fulfilled', auth, repo, user, installation: gh.status !== 'fulfilled' ? 'Установите GitHub CLI: https://cli.github.com/ затем выполните gh auth login.' : !auth ? 'Выполните gh auth login и завершите авторизацию в браузере.' : null }); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/apps') { send(res, 200, { apps: readJson(path.join(ROOT, 'data/apps.json')), categories: readJson(path.join(ROOT, 'data/categories.json')) }); return; }
    if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
      let relative; try { relative = decodeURIComponent(url.pathname.slice('/media/'.length)); } catch { return send(res, 400, { error: 'Некорректный путь к изображению.' }); }
      const publicRoot = path.resolve(ROOT, 'public'); const imagePath = path.resolve(publicRoot, relative);
      if (!imagePath.startsWith(`${publicRoot}${path.sep}`)) return send(res, 403, { error: 'Доступ к файлу запрещён.' });
      if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) return send(res, 404, { error: 'Изображение не найдено.' });
      const mime = ({ '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml' })[path.extname(imagePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(fs.readFileSync(imagePath)); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/media/upload') {
      const { fields, files } = await parseMultipart(req, 52 * 1024 * 1024, 'Изображения превышают общий лимит 52 МБ.');
      const id = String(fields.id || '').trim(); const kind = fields.kind;
      if (!safeId(id)) return send(res, 400, { error: 'Сначала укажите ID приложения латиницей, цифрами и дефисами.' });
      if (!['icon', 'screenshot'].includes(kind)) return send(res, 400, { error: 'Неизвестный тип изображения.' });
      const incoming = files.files ? (Array.isArray(files.files) ? files.files : [files.files]) : [];
      if (kind === 'icon' && incoming.length !== 1) return send(res, 400, { error: 'Для иконки выберите один файл.' });
      if (kind === 'screenshot' && (!incoming.length || incoming.length > 10)) return send(res, 400, { error: 'Выберите от 1 до 10 скриншотов за один раз.' });
      const apps = readJson(path.join(ROOT, 'data/apps.json')); const current = apps.find(app => app.id === id);
      if (kind === 'screenshot' && (current?.screenshots?.length || 0) + incoming.length > 10) return send(res, 400, { error: 'Для приложения разрешено не больше 10 скриншотов.' });
      const directory = kind === 'icon' ? 'icons' : 'screenshots'; const destination = path.join(ROOT, 'public', directory); fs.mkdirSync(destination, { recursive: true });
      const saved = [];
      for (const file of incoming) {
        if (!file.content.length || file.content.length > 5 * 1024 * 1024) return send(res, 400, { error: 'Каждое изображение должно быть не больше 5 МБ.' });
        const extension = path.extname(file.name).toLowerCase(); const bytes = file.content;
        const valid = extension === '.png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
          : ['.jpg','.jpeg'].includes(extension) ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : extension === '.webp' ? bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' : false;
        if (!valid) return send(res, 400, { error: 'Поддерживаются только настоящие PNG, JPG и WebP изображения.' });
        const filename = `${id}-${kind}-${crypto.randomUUID()}${extension}`; fs.writeFileSync(path.join(destination, filename), bytes, { flag: 'wx' });
        saved.push({ path: `/${directory}/${filename}`, previewUrl: `/media/${directory}/${filename}`, name: file.name, size: bytes.length });
      }
      send(res, 200, { files: saved }); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/ipa/inspect') {
      const { files } = await parseMultipart(req); const ipa = files.ipa; if (!ipa || Array.isArray(ipa) || !ipa.name.toLowerCase().endsWith('.ipa')) return send(res, 400, { error: 'Выберите файл с расширением .ipa' });
      const digest = crypto.createHash('sha256').update(ipa.content).digest('hex'); const temp = path.join(uploads, `${crypto.randomUUID()}.ipa`); fs.writeFileSync(temp, ipa.content, { flag: 'wx' });
      let valid = false, metadata = {}, plistError = null;
      try { const { stdout } = await run('tar', ['-tf', temp], { maxBuffer: 8 * 1024 * 1024 }); const plist = stdout.split(/\r?\n/).find(x => /^Payload\/[^/]+\.app\/Info\.plist$/.test(x)); if (!plist) throw Error('В архиве не найден Payload/*.app/Info.plist'); valid = true; try { const { stdout: xml } = await run('tar', ['-xOf', temp, plist], { encoding: 'buffer', maxBuffer: 1024 * 1024 }); const text = xml.toString('utf8'); const get = key => { const re = new RegExp(`<key>${key}<\\/key>\\s*<(?:string|integer)>([^<]*)<`); return text.match(re)?.[1] || ''; }; metadata = { bundleId: get('CFBundleIdentifier'), version: get('CFBundleShortVersionString') || get('CFBundleVersion'), name: get('CFBundleDisplayName') || get('CFBundleName'), iosMinimum: get('MinimumOSVersion') }; } catch (e) { plistError = e.message; } } catch (e) { return send(res, 400, { error: `IPA не прошёл проверку структуры: ${e.message}` }); }
      send(res, 200, { file: path.basename(temp), filename: ipa.name, size: ipa.content.length, sha256: digest, valid, metadata, plistError }); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/categories/save') { const item=await body(req); if(!safeId(item.id)||!item.name?.trim()) return send(res,400,{error:'Укажите slug (латиница, цифры, дефис) и название категории.'}); const file=path.join(ROOT,'data/categories.json'), list=readJson(file); const ix=list.findIndex(c=>c.id===item.id); if(ix>=0) list[ix]={...list[ix],...item}; else list.push({id:item.id,name:item.name.trim(),icon:item.icon||'＋',description:item.description||''}); fs.writeFileSync(file,JSON.stringify(list,null,2)+'\n'); send(res,200,{ok:true,categories:list}); return; }
    if (req.method === 'POST' && url.pathname === '/api/categories/delete') { const {id}=await body(req); const apps=readJson(path.join(ROOT,'data/apps.json')); if(apps.some(a=>a.category===id)) return send(res,409,{error:'В категории есть приложения. Переместите их в другую категорию перед удалением.'}); const file=path.join(ROOT,'data/categories.json'), list=readJson(file), next=list.filter(c=>c.id!==id); if(next.length===list.length)return send(res,404,{error:'Категория не найдена'}); fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n'); send(res,200,{ok:true,categories:next}); return; }
    if (req.method === 'POST' && url.pathname === '/api/apps/save') { const item = await body(req); if (!safeId(item.id) || !item.name || !item.developer || !item.bundleId || !item.version || !item.category || !item.description) return send(res, 400, { error: 'Заполните ID, название, разработчика, Bundle ID, версию, категорию и описание.' }); if (!safeMediaPath(item.icon, 'icons') || !Array.isArray(item.screenshots) || item.screenshots.length > 10 || item.screenshots.some(image => !safeMediaPath(image, 'screenshots'))) return send(res, 400, { error: 'Иконка или скриншоты имеют неверный путь. Выберите изображения через загрузчик панели.' }); const list = readJson(path.join(ROOT, 'data/apps.json')); const duplicate = list.find(a => a.id !== item.id && (a.bundleId.toLowerCase() === item.bundleId.toLowerCase() || a.name.toLowerCase() === item.name.toLowerCase())); if (duplicate) return send(res, 409, { error: `Похоже на дубликат: ${duplicate.name} (${duplicate.id}).` }); const ix = list.findIndex(a => a.id === item.id); if (ix >= 0) list[ix] = { ...list[ix], ...item, updatedDate: new Date().toISOString().slice(0,10) }; else list.unshift({ ...item, addedDate: new Date().toISOString().slice(0,10), updatedDate: new Date().toISOString().slice(0,10), changelog: [], popularity: 0, featured: false, status: 'draft', screenshots: [], size: null, downloadUrl: null, sha256: null, source: '', distributionPermission: false }); fs.writeFileSync(path.join(ROOT,'data/apps.json'), JSON.stringify(list,null,2)+'\n'); send(res, 200, { ok: true, apps: list }); return; }
    if (req.method === 'POST' && url.pathname === '/api/apps/delete') {
      const { id } = await body(req); const appsPath = path.join(ROOT, 'data/apps.json'); const list = readJson(appsPath); const app = list.find(item => item.id === id);
      if (!app) return send(res, 404, { error: 'Приложение не найдено.' });
      const authenticated = await run('gh', ['auth', 'status']).then(() => true).catch(() => false);
      if (!authenticated) return send(res, 400, { error: 'Не удалось удалить приложение с сайта: сначала подключите GitHub CLI в разделе «Настройки».' });
      const repo = await run('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).then(result => result.stdout.trim()).catch(() => '');
      if (!repo) return send(res, 400, { error: 'Не удалось определить GitHub-репозиторий. Проверьте подключение vstore.' });
      const next = list.filter(item => item.id !== id); fs.writeFileSync(appsPath, JSON.stringify(next, null, 2) + '\n');
      try {
        await run('git', ['commit', '--only', '-m', `Remove ${app.name} from catalog`, '--', 'data/apps.json']);
        await run('git', ['push']);
        send(res, 200, { ok: true, apps: next, published: true, message: 'Приложение удалено из каталога. GitHub Actions обновит сайт.' }); return;
      } catch (error) {
        send(res, 200, { ok: true, apps: next, published: false, warning: `Запись удалена локально, но изменения не отправлены в GitHub: ${error.message}` }); return;
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/publish') {
      const { id, file, notes, source, distributionPermission } = await body(req); const appsPath=path.join(ROOT,'data/apps.json'); const list=readJson(appsPath); const app=list.find(a=>a.id===id); if(!app) return send(res,404,{error:'Приложение не найдено'}); if(!distributionPermission) return send(res,400,{error:'Подтвердите право на распространение.'}); if(!source?.trim()) return send(res,400,{error:'Укажите источник IPA.'}); if(!file || !/^[0-9a-f-]+\.ipa$/.test(file)) return send(res,400,{error:'Загрузите и проверьте IPA перед публикацией.'}); const ipaPath=path.join(uploads,file); if(!fs.existsSync(ipaPath)) return send(res,400,{error:'Проверенная IPA не найдена. Загрузите файл заново.'});
      const gh=await run('gh',['auth','status']).catch(()=>null); if(!gh) return send(res,400,{error:'GitHub CLI не авторизован. Выполните gh auth login.'}); const repo=await run('gh',['repo','view','--json','nameWithOwner','-q','.nameWithOwner']).then(r=>r.stdout.trim()).catch(()=>null); if(!repo) return send(res,400,{error:'Текущая папка не связана с GitHub-репозиторием. Подключите git remote и gh repo set-default.'});
      const milestones=[]; const emit=(step,state,detail='')=>{milestones.push({step,state,detail,at:new Date().toISOString()});}; const tag=`${app.id}-${app.version}`; const releaseIpa=path.join(uploads,`${app.id}-${app.version}.ipa`); fs.copyFileSync(ipaPath,releaseIpa);
      try { emit('Проверка IPA','done',`${(fs.statSync(ipaPath).size/1048576).toFixed(1)} МБ`); await run('gh',['release','view',tag,'--repo',repo]); throw Error(`Релиз ${tag} уже существует. Измените версию.`); } catch(e) { if(e.message.includes('уже существует')) throw e; }
      try { emit('Создание GitHub Release','running'); await run('gh',['release','create',tag,releaseIpa,'--repo',repo,'--title',`${app.name} ${app.version}`,'--notes',notes||'Обновление приложения.']); app.downloadUrl=`https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(path.basename(releaseIpa))}`; app.size=fs.statSync(ipaPath).size; app.sha256=crypto.createHash('sha256').update(fs.readFileSync(ipaPath)).digest('hex'); app.source=source.trim(); app.distributionPermission=true; app.status='published'; app.updatedDate=new Date().toISOString().slice(0,10); app.changelog.unshift({version:app.version,date:app.updatedDate,notes:notes||'Обновление приложения.'}); emit('GitHub Release','done',tag);
      } catch(e) { emit('GitHub Release','error',e.message); return send(res,500,{error:`Ошибка этапа GitHub Release: ${e.message}`,milestones}); }
      try { emit('Обновление JSON','running'); fs.writeFileSync(appsPath,JSON.stringify(list,null,2)+'\n'); emit('Обновление JSON','done'); } catch(e) { emit('Обновление JSON','error',e.message); return send(res,500,{error:`Release создан, но JSON не удалось сохранить: ${e.message}`,milestones}); }
      try { emit('Git commit и push','running'); await run('git',['add','data/apps.json','public/icons','public/screenshots']); await run('git',['commit','-m',`Publish ${app.name} ${app.version}`]); await run('git',['push']); emit('Git commit и push','done','GitHub Actions запустит публикацию сайта.'); } catch(e) { emit('Git commit и push','error',e.message); return send(res,500,{error:`Release и JSON созданы, но git push завершился ошибкой: ${e.message}`,milestones,partial:true}); }
      send(res,200,{ok:true,milestones,app}); return;
    }
    if (req.method === 'GET' && url.pathname === '/') { const html=fs.readFileSync(path.join(__dirname,'index.html')); res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); res.end(html); return; }
    send(res,404,{error:'Не найдено'});
  } catch (error) { send(res,500,{error:error.message||'Неожиданная ошибка сервера'}); }
}
const server=http.createServer(handler);
server.listen(PORT,HOST,()=>{ console.log(`VStore Admin: http://${HOST}:${PORT}`); if(process.platform==='win32') spawn('cmd',['/c','start','',`http://${HOST}:${PORT}`],{stdio:'ignore',windowsHide:true}); });
server.on('error',e=>{console.error(`Не удалось запустить локальную панель: ${e.message}`);process.exitCode=1;});


