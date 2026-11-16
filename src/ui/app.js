'use strict';

const api = window.apkstart;
const $ = (id) => document.getElementById(id);
const t = (k, p) => window.I18n.t(k, p);

const state = {
  apps: [],
  settings: null,
  status: null,
  filter: '',
  installing: false,
  setupBusy: null,
  menuPkg: null,
};

/* ---------------- 工具 ---------------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function initialOf(label) {
  const t = String(label || '?').trim();
  return (t[0] || '?').toUpperCase();
}

function fmtSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

function relTime(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return t('app.rel.justNow');
  if (d < 3600000) return t('app.rel.minutesAgo', { n: Math.floor(d / 60000) });
  if (d < 86400000) return t('app.rel.hoursAgo', { n: Math.floor(d / 3600000) });
  if (d < 86400000 * 30) return t('app.rel.daysAgo', { n: Math.floor(d / 86400000) });
  return new Date(ts).toLocaleDateString(window.I18n.locale);
}

/**
 * 迷你 toast
 *
 * 同一类消息做去重 + 数量上限：
 * 安装失败时里面有「运行时启动日志」在持续推送，以前每条都新建一个 toast，
 * 于是屏幕上会不停叠加同一条错误，看起来像「失败信息一直循环」。
 */
let _toastSeq = 0;
function toast({ title, body = '', type = 'info', progress = null, sticky = false, spinner = false }) {
  const wrap = $('toastWrap');
  // ① 去重：同样的标题 + 正文（4 秒内）只刷新那一条，不叠加
  const key = `${title}|${body}`;
  const dup = [...wrap.children].find((n) => n.dataset.key === key && Date.now() - Number(n.dataset.at || 0) < 4000);
  if (dup) {
    dup.dataset.at = String(Date.now());
    return {
      el: dup,
      dismiss: () => dup.remove(),
      update: ({ title: t2, body: b2 } = {}) => {
        if (t2 !== undefined) dup.querySelector('.t-title-text').textContent = t2;
        if (b2 !== undefined) dup.querySelector('.t-body').textContent = b2;
      },
    };
  }
  // ② 上限：同时最多 4 条，超出先挤掉最旧的
  while (wrap.children.length >= 4) wrap.firstElementChild.remove();

  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.dataset.key = key;
  el.dataset.at = String(Date.now());
  el.dataset.seq = String(++_toastSeq);
  el.innerHTML = `
    <div class="t-title">
      ${spinner ? '<span class="spinner"></span>' : ''}
      <span class="t-title-text">${esc(title)}</span>
    </div>
    <div class="t-body">${esc(body)}</div>
    ${progress === null ? '' : '<div class="bar"><i></i></div>'}
  `;
  $('toastWrap').appendChild(el);

  const dismiss = () => {
    el.style.transition = 'opacity .18s, transform .18s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => el.remove(), 200);
  };

  const ctl = {
    el, dismiss,
    update({ title: t2, body: b2, progress: p2, type: ty } = {}) {
      if (t2 !== undefined) el.querySelector('.t-title-text').textContent = t2;
      if (b2 !== undefined) el.querySelector('.t-body').textContent = b2;
      if (p2 !== undefined && el.querySelector('.bar i')) {
        el.querySelector('.bar i').style.width = `${Math.max(2, Math.min(100, p2))}%`;
      }
      if (ty === 'error') el.classList.add('error');
      if (ty === 'ok') {
        el.querySelector('.spinner')?.remove();
        el.classList.remove('error');
      }
    },
  };

  if (!sticky) setTimeout(dismiss, type === 'error' ? 6000 : 3200);
  return ctl;
}

/* ---------------- 渲染 ---------------- */

function visibleApps() {
  const q = state.filter.trim().toLowerCase();
  if (!q) return state.apps;
  return state.apps.filter((a) => (
    a.label.toLowerCase().includes(q)
    || a.package.toLowerCase().includes(q)
  ));
}

function renderGrid() {
  const apps = visibleApps();
  const grid = $('grid');
  const empty = $('empty');

  const hasAny = state.apps.length > 0;
  grid.classList.toggle('hidden', apps.length === 0);
  empty.classList.toggle('hidden', apps.length > 0);

  if (!hasAny) {
    const s = state.status;
    $('emptyHint').textContent = s && s.adbOk === false
      ? t('app.empty.hintFirstUse')
      : t('app.empty.hintShared');
    grid.innerHTML = '';
    return;
  }

  grid.innerHTML = apps.map((a) => `
    <div class="card" data-pkg="${esc(a.package)}" title="${esc(a.label)} · ${esc(a.package)}">
      ${a.pinned ? '<span class="pin">★</span>' : ''}
      ${a.running ? `<span class="badge-run" title="${t('app.card.runningTitle')}"></span>` : ''}
      <div class="icon">
        ${a.iconUrl
          ? `<img src="${esc(a.iconUrl)}" alt="" draggable="false" />`
          : `<div class="fallback" style="background:${esc(a.accent || '#9aa6b2')}">${esc(initialOf(a.label))}</div>`}
      </div>
      <div class="name">${esc(a.label)}</div>
      <div class="meta">${a.running ? t('app.card.running') : `v${esc(a.versionName)}${a.lastLaunchAt ? ' · ' + relTime(a.lastLaunchAt) : ''}`}</div>
      <div class="open-hint">${a.running ? t('app.card.bringFront') : t('app.card.open')}</div>
    </div>
  `).join('');
}

/* ---------------- 数据刷新 ---------------- */

async function refreshApps() {
  try {
    state.apps = await api.listApps();
    renderGrid();
    updateStats();
  } catch (e) {
    console.error(e);
  }
}

function updateStats() {
  const n = state.apps.length;
  $('statusStats').textContent = n ? t('app.stats.apps', { n }) : t('app.stats.none');
}

async function refreshStatus() {
  try {
    state.status = await api.runtimeStatus();
    const s = state.status;
    const dot = $('statusDot');
    const text = $('statusText');
    const tag = $('engineTag');

    if (!s.adbOk) {
      dot.className = 'dot err';
      text.textContent = t('app.status.notDeployed');
      tag.textContent = t('app.tag.needsDeploy');
      tag.className = 'brand-tag';
    } else if (s.deviceOnline) {
      dot.className = 'dot ok';
      text.textContent = t('app.status.ready', { android: s.android || '?' }) + (s.freeform ? t('app.status.freeformSuffix') : '');
      tag.textContent = `Android ${s.android || ''}`.trim();
      tag.className = 'brand-tag ok';
    } else if (s.phase === 'booting' || s.vmStarting) {
      dot.className = 'dot warn';
      text.textContent = t('app.status.booting');
      tag.textContent = t('app.tag.booting');
      tag.className = 'brand-tag';
    } else if (s.needsSetup === 'accel') {
      dot.className = 'dot warn';
      text.textContent = t('app.status.noAccel');
      tag.textContent = t('app.tag.software');
      tag.className = 'brand-tag';
    } else if (s.needsSetup === 'sysimg') {
      dot.className = 'dot err';
      text.textContent = t('app.status.missingSysimg');
      tag.textContent = t('app.tag.needsSysimg');
      tag.className = 'brand-tag';
    } else if (s.needsSetup === 'emulator') {
      dot.className = 'dot err';
      text.textContent = t('app.status.missingEmulator');
      tag.textContent = t('app.tag.needsDeploy');
      tag.className = 'brand-tag';
    } else if (s.needsSetup === 'boot') {
      dot.className = 'dot warn';
      text.textContent = t('app.status.readyIdle');
      tag.textContent = t('app.tag.needsBoot');
      tag.className = 'brand-tag';
    } else if (s.installing) {
      dot.className = 'dot warn';
      text.textContent = t('app.status.installerRunning');
      tag.textContent = t('app.tag.installing');
      tag.className = 'brand-tag';
    } else {
      dot.className = 'dot';
      text.textContent = s.installed
        ? t('app.status.standby')
        : t('app.status.notInstalled');
      tag.textContent = s.installed ? t('app.tag.standby') : t('app.tag.needsInstall');
      tag.className = 'brand-tag';
    }
    $('statusDevice').textContent = s.deviceOnline ? (s.serial || '') : '';

    renderSetup(s);
  } catch (e) {
    $('statusText').textContent = t('app.status.checkFailed', { msg: e.message });
  }
}

/* ---------------- 运行时部署（固定在设置里） ---------------- */

/**
 * 运行时/部署/自检面板现在都收在「设置」里，主界面只留已安装应用。
 * 保留 showSetup 给托盘菜单与 ui:navigate 复用，语义改为「打开设置并定位到运行时」。
 */
function showSetup(on) {
  if (!on) { $('setupGuide').hidden = true; return; }
  openSettings().then(() => {
    const box = $('runtimeGroup');
    if (box) box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }).catch(() => {});
}

function fmtGB(n) { return n ? `${(n / 1073741824).toFixed(2)} GB` : ''; }

function stepRow(opt) {
  const cls = ['step'];
  if (opt.done) cls.push('done');
  if (opt.busy) cls.push('busy');
  return `
    <div class="${cls.join(' ')}" data-step="${opt.key}">
      <div class="idx">${opt.done ? '✓' : opt.index}</div>
      <div class="body">
        <div class="t">${esc(opt.title)}${opt.tag ? `<span class="tag ${opt.req ? 'req' : ''}">${esc(opt.tag)}</span>` : ''}</div>
        <div class="d" data-desc>${esc(opt.desc)}</div>
        <div class="bar"><i data-bar></i></div>
      </div>
      <div class="act">${opt.actions || ''}</div>
    </div>`;
}

function renderSetup(s) {
  if (!s) return;
  const env = s.env || {};
  const hv = env.hypervisor || {};
  const accel = env.accel || s.accel || {};

  // 启动即见已安装应用：不再用部署向导整屏接管主界面，
  // 状态只在设置里的运行时面板 + 底部状态条上体现。
  const accelOk = accel.ok || hv.whpx;
  const adbDone = !!(env.adb && env.adb.ok);
  const emuDone0 = !!(env.emulator && env.emulator.ok);
  const imgDone0 = !!(env.sysimg && env.sysimg.ok);
  const allDone0 = adbDone && emuDone0 && imgDone0;
  const stateText = $('setupStateText');
  if (stateText) {
    const missing = [];
    if (!adbDone) missing.push('adb');
    if (!emuDone0) missing.push(t('app.setup.missingEngine'));
    if (!imgDone0) missing.push(t('app.setup.missingSysimg'));
    stateText.textContent = s.deviceOnline
      ? t('app.setup.ready', { android: s.android || '' })
      : s.phase === 'booting' || s.vmStarting
        ? t('app.status.booting')
        : allDone0
          ? t('app.setup.allReadyIdle')
          : t('app.setup.missing', { items: missing.join(t('app.sep.list')) }) + (accelOk ? '' : t('app.setup.noAccelSuffix'));
    stateText.title = s.autoProfile || accel.note || hv.note || '';
  }

  const emuDone = !!(env.emulator && env.emulator.ok);
  const imgDone = !!(env.sysimg && env.sysimg.ok);
  const busy = state.setupBusy;
  const booting = s.phase === 'booting';

  // 只保留一个步骤：下载、参数自适应、开机全部由「一键完成」串起来，
  // 且首次启动会在后台自动跑，用户不需要逐步点击。
  const allDone = !!(env.adb && env.adb.ok) && emuDone && imgDone;
  const left = [];
  if (!(env.adb && env.adb.ok)) left.push(t('app.setup.leftAdb'));
  if (!emuDone) left.push(t('app.setup.leftRuntime'));
  if (!imgDone) left.push(t('app.setup.leftSysimg'));
  const step = {
    key: 'all',
    index: 1,
    title: allDone ? t('app.setup.stepDoneTitle') : t('app.setup.stepTitle'),
    tag: allDone ? t('app.setup.tagAutoDone') : t('app.setup.tagAuto'),
    done: allDone,
    busy: !!busy,
    desc: s.deviceOnline
      ? t('app.setup.descReady', { android: s.android || '' })
      : booting
        ? t('app.status.booting')
        : allDone
          ? t('app.setup.descAllDone')
          : t('app.setup.descMissing', { items: left.join(t('app.sep.list')) }),
    actions: s.deviceOnline
      ? `<button class="btn ghost sm" data-act="vmStop">${t('app.setup.stopRuntime')}</button>`
      : '',
  };

  $('setupSteps').innerHTML = stepRow(step);
  $('btnDeployAll').disabled = !!busy;
  $('btnDeployAll').textContent = busy ? t('app.common.preparing') : (allDone ? t('app.setup.deployDone') : t('app.setup.deployAll'));
  // 「上次为什么没起来」优先显示落盘的失败记录：进程重启后内存里的 diagnosis 是空的，
  // 只显示 autoProfile 会让用户完全看不出原因（issue #20/#25 的报告就是这样）。
  const lf = s.lastFailure;
  const lastMsg = (lf && lf.diagnosis && lf.diagnosis.title)
    ? t('app.setup.lastFailure', { title: lf.diagnosis.title })
    : (s.diagnosis ? t('app.setup.lastDiagnosis', { title: s.diagnosis.title }) : '');
  $('setupNote').textContent = lastMsg
    || s.autoProfile || t('app.setup.noteDefault');
}

function store_getDiskSize() {
  return (state.settings && state.settings.runtime && state.settings.runtime.diskSizeGB) || 24;
}

function setStepBusy(key, on) {
  state.setupBusy = on ? key : null;
  // 五步已合并成一行，所有子步骤的进度都落在这唯一的进度条上
  const row = $('setupSteps').querySelector('[data-step="all"]');
  if (row) {
    row.classList.toggle('busy', !!on);
    if (on) {
      const bar = row.querySelector('[data-bar]');
      if (bar) bar.style.width = '3%';
    }
  }
}

function updateStepProgress(component, p) {
  if (!component) return;
  const row = $('setupSteps').querySelector('[data-step="all"]');
  if (!row) return;
  if (p.percent !== undefined) {
    const bar = row.querySelector('[data-bar]');
    if (bar) bar.style.width = `${Math.max(3, Math.min(100, p.percent))}%`;
  }
  if (p.message) {
    const d = row.querySelector('[data-desc]');
    if (d) d.textContent = p.message;
  }
}

async function deployAll() {
  if (state.setupBusy) return;
  setStepBusy('all', true);
  try {
    // 一次调用把 adb / 引擎 / 系统镜像全装完，进度统一显示在唯一那一行
    const r = await api.autoDeploy();
    if (!r || !r.ok) {
      toast({ title: t('app.deploy.failedTitle'), body: (r && r.error) || t('app.deploy.failedFallback'), type: 'error', sticky: true });
      return;
    }
    await refreshStatus();
    toast({ title: t('app.deploy.readyTitle'), body: t('app.deploy.readyBody'), type: 'info' });
    const started = await api.runtimeStart();
    await refreshStatus();
    toast(started && started.ok
      ? { title: t('app.runtime.readyTitle'), body: t('app.runtime.readyBody'), type: 'ok' }
      : { title: t('app.deploy.bootIncomplete'), body: (started && started.error) || t('app.deploy.bootIncompleteFallback'), type: 'error', sticky: true });
  } catch (e) {
    toast({ title: t('app.deploy.failedTitle'), body: e.message, type: 'error', sticky: true });
  } finally {
    setStepBusy('all', false);
    await refreshStatus();
    selfCheck();
  }
}

async function runStep(key) {
  if (state.setupBusy) return { ok: false, error: t('app.step.busyError') };
  setStepBusy(key, true);
  let r;
  try {
    if (key === 'adb') r = await api.installAdb();
    else if (key === 'emulator') r = await api.installEmulator();
    else if (key === 'sysimg') r = await api.installSysimg();
    else if (key === 'accel') {
      const t = toast({
        title: window.I18n.t('app.accel.installingTitle'),
        body: window.I18n.t('app.accel.installingBody'),
        sticky: true,
        spinner: true,
      });
      r = await api.enableAccel();
      if (r.ok) t.update({ title: window.I18n.t('app.accel.enabled'), type: 'ok' });
      else t.update({ title: window.I18n.t('app.accel.notEnabled'), body: r.error, type: 'error', sticky: true });
    } else if (key === 'qemu') r = await api.installQemu();
    else if (key === 'iso') r = await api.downloadIso();
    else if (key === 'disk') r = await api.createDisk(store_getDiskSize());
    else r = { ok: false, error: t('app.step.unknown') };
  } catch (e) {
    r = { ok: false, error: e.message };
  }
  setStepBusy(key, false);
  await refreshStatus();
  return r;
}

async function startInstall() {
  const r = await api.startInstaller();
  if (!r.ok) {
    toast({ title: t('app.installer.cannotStart'), body: r.error, type: 'error', sticky: true });
    return;
  }
  $('setupGuide').hidden = false;
  $('setupGuide').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast({ title: t('app.installer.vmOpened'), body: t('app.installer.vmOpenedBody'), type: 'ok', sticky: true });
}

async function markInstalled() {
  await api.markInstalled();
  await api.runtimeStop();
  $('setupGuide').hidden = true;
  await refreshStatus();
  toast({ title: t('app.installer.doneTitle'), body: t('app.installer.doneBody'), type: 'ok' });
}



/* ---------------- 安装 ---------------- */

/** 把安装失败翻译成「下一步该做什么」，只对最常见的几种做提示，其它原样显示 */
function friendlyInstallErrorText(msg) {
  const s = String(msg || t('app.error.unknown'));
  if (/INSUFFICIENT_STORAGE|not enough space|空间不足|ENOSPC/i.test(s)) {
    return t('app.installError.storage', { msg: s });
  }
  if (/NO_MATCHING_ABIS/i.test(s)) return t('app.installError.abis', { msg: s });
  if (/INSTALL_FAILED_ALREADY_EXISTS|signatures do not match/i.test(s)) {
    return t('app.installError.signature', { msg: s });
  }
  if (/INSTALL_FAILED_VERSION_DOWNGRADE/i.test(s)) return t('app.installError.downgrade', { msg: s });
  if (/ERR_FS_FILE_TOO_LARGE|greater than possible Buffer|Cannot allocate|ENOMEM|out of memory/i.test(s)) {
    return t('app.installError.tooLarge', { msg: s });
  }
  return s;
}

/* 当前那条「正在安装…」的 sticky 提示。install:error 事件要能把它收掉：
 * 主进程是先 send('install:error') 再让 invoke 失败的，两者都可能到得很晚，
 * 只靠 catch 收会出现「报错了右下角还在转圈」。 */
let installToast = null;

async function installFiles(paths) {
  if (!paths || !paths.length) return;
  if (state.installing) {
    toast({ title: t('app.install.busyTitle'), body: t('app.install.busyBody') });
    return;
  }
  state.installing = true;
  let ok = 0;
  let failed = 0;

  for (const p of paths) {
    const name = p.split(/[\\/]/).pop();
    const t = toast({ title: window.I18n.t('app.install.installing', { name }), body: window.I18n.t('app.install.parsing'), progress: 8, sticky: true, spinner: true });
    installToast = t;
    let off = () => {};
    try {
      off = api.on('install:progress', (pr) => {
        const base = { parse: 12, 'parse-done': 24, runtime: 38, install: 62, shortcut: 88, done: 100 }[pr.stage] || 50;
        const pct = pr.percent != null ? Math.min(60, Math.round((pr.percent / 100) * 60)) : base;
        t.update({ title: window.I18n.t('app.install.installing', { name: pr.meta ? pr.meta.label : name }), body: pr.message, progress: pct });
      });
      const r = await api.installApk(p);
      t.update({ title: window.I18n.t('app.install.installed', { label: r.app.label }), body: r.app.shortcutPath ? window.I18n.t('app.install.shortcutCreated') : window.I18n.t('app.install.shortcutHint'), progress: 100, type: 'ok' });
      t.el.querySelector('.spinner')?.remove();
      setTimeout(t.dismiss, 3600);
      if (r.warnings && r.warnings.length) {
        toast({ title: window.I18n.t('app.install.compatWarning', { label: r.app.label }), body: r.warnings.join(' '), type: 'error', sticky: false });
      }
      ok++;
    } catch (e) {
      failed++;
      // 先把那条「正在安装…」的 sticky 提示收掉，否则它会一直转圈、还继续被
      // 运行时日志刷新 —— 用户看到的就是「失败信息一直在循环」。
      // 错误提示统一由下面的 install:error 监听器负责（带文件名与中文原因），
      // 这里不再重复弹一条。
      try { off(); } catch (_) { /* ignore */ }
      t.dismiss();
      if (installToast === t) installToast = null;
    } finally {
      try { off(); } catch (_) { /* ignore */ }
    }
  }

  state.installing = false;
  await refreshApps();
  if (ok && !failed) $('search').value = '';
}

/* ---------------- 应用操作 ---------------- */

async function launchApp(pkg) {
  const app = state.apps.find((a) => a.package === pkg);
  state.launchPkg = pkg;
  const t = toast({
    title: window.I18n.t('app.launch.opening', { label: app ? app.label : pkg }),
    body: window.I18n.t('app.launch.warming'),
    sticky: true,
    spinner: true,
  });
  const r = await api.launch(pkg);
  if (r.ok) {
    // 应用有自己的窗口，主界面自动收起；这里只留一句提示，然后隐藏窗口
    t.update({ title: window.I18n.t('app.launch.started'), body: window.I18n.t('app.launch.startedBody'), type: 'ok' });
    setTimeout(t.dismiss, 1600);
    setTimeout(() => api.winHide(), 900);
    setTimeout(refreshApps, 1200);
  } else {
    t.update({ title: window.I18n.t('app.launch.failed'), body: r.error, type: 'error' });
    setTimeout(t.dismiss, 6000);
  }
}

async function createShortcut(pkg) {
  try {
    const r = await api.createShortcut(pkg);
    toast({ title: t('app.shortcut.created'), body: r.path, type: 'ok' });
    refreshApps();
  } catch (e) {
    toast({ title: t('app.shortcut.createFailed'), body: e.message, type: 'error' });
  }
}

async function uninstall(pkg) {
  const app = state.apps.find((a) => a.package === pkg);
  if (!app) return;
  const ok = window.confirm(t('app.uninstall.confirm', { label: app.label }));
  if (!ok) return;
  try {
    await api.uninstall(pkg);
    toast({ title: t('app.uninstall.done'), body: app.label, type: 'ok' });
    refreshApps();
  } catch (e) {
    toast({ title: t('app.uninstall.failed'), body: e.message, type: 'error' });
  }
}

/* ---------------- 右键菜单 ---------------- */

const MENU_ITEMS = [
  { key: 'open', labelKey: 'app.menu.open', kbd: 'Enter' },
  { key: 'shortcut', labelKey: 'app.menu.shortcut' },
  { key: 'pin', labelKey: 'app.menu.pin' },
  { divider: true },
  { key: 'reveal', labelKey: 'app.menu.reveal' },
  { key: 'clear', labelKey: 'app.menu.clear' },
  { divider: true },
  { key: 'uninstall', labelKey: 'app.menu.uninstall', danger: true },
];

function showMenu(x, y, pkg) {
  const menu = $('ctxmenu');
  state.menuPkg = pkg;
  const app = state.apps.find((a) => a.package === pkg);
  menu.innerHTML = MENU_ITEMS.map((it) => {
    if (it.divider) return '<div class="divider"></div>';
    const label = it.key === 'pin' ? (app && app.pinned ? t('app.menu.unpin') : t('app.menu.pin')) : t(it.labelKey);
    return `<div class="item ${it.danger ? 'danger' : ''}" data-act="${it.key}">
      <span>${esc(label)}</span>${it.kbd ? `<span class="k">${it.kbd}</span>` : ''}
    </div>`;
  }).join('');
  menu.classList.add('on');

  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 10)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 10)}px`;
}

function hideMenu() {
  $('ctxmenu').classList.remove('on');
  state.menuPkg = null;
}

async function handleMenu(act) {
  const pkg = state.menuPkg;
  const app = state.apps.find((a) => a.package === pkg);
  hideMenu();
  if (!app) return;
  switch (act) {
    case 'open': return launchApp(pkg);
    case 'shortcut': return createShortcut(pkg);
    case 'pin': return api.pin(pkg, !app.pinned).then(refreshApps);
    case 'reveal': return api.revealApk(pkg);
    case 'clear': {
      if (!window.confirm(t('app.clear.confirm', { label: app.label }))) return;
      try {
        await api.clearData(pkg);
        toast({ title: t('app.clear.done'), body: app.label, type: 'ok' });
      } catch (e) {
        toast({ title: t('app.clear.failed'), body: e.message, type: 'error' });
      }
      return;
    }
    case 'uninstall': return uninstall(pkg);
    default: return undefined;
  }
}

/* ---------------- 设置 ---------------- */

// ---------------- 安卓系统设置 ----------------

let volumeTimer = null;

async function refreshAndroid() {
  const el = $('androidStatus');
  if (!el) return;
  el.textContent = t('app.android.reading');
  const r = await api.android.status().catch(() => null);
  if (!r || !r.ok) {
    el.textContent = r && r.error ? t('app.android.notReady', { error: String(r.error).slice(0, 36) }) : t('app.android.notRunning');
    return;
  }
  el.textContent = t('app.android.status', { sdk: r.sdk || '?', wifi: t(r.wifi ? 'app.android.wifiOn' : 'app.android.wifiOff'), airplane: r.airplane ? t('app.android.airplaneSuffix') : '', volume: r.volume });
  $('setAndroidWifi').checked = !!r.wifi;
  $('setAndroidAirplane').checked = !!r.airplane;
  $('setAndroidAnim').checked = !r.animationsOff;
  $('setAndroidVolume').value = r.volume;
  $('androidVolumeText').textContent = `${r.volume}%`;
  if (r.fontScale) $('setAndroidFont').value = Number(r.fontScale).toFixed(2);
  if (r.density) {
    const opt = [...$('setAndroidDensity').options].find((o) => o.value === String(r.density));
    if (opt) $('setAndroidDensity').value = String(r.density);
  }
}

function bindAndroid() {
  const set = async (key, value, msg) => {
    const r = await api.android.set(key, value).catch(() => null);
    toast({
      type: r && r.ok ? 'ok' : 'error',
      title: r && r.ok ? (msg || t('app.android.applied')) : t('app.android.failed', { error: (r && r.error) || t('app.android.notReadyShort') }),
    });
    if (r && r.ok) refreshAndroid();
  };
  $('setAndroidWifi').addEventListener('change', (e) => set('wifi', e.target.checked, e.target.checked ? t('app.android.wifiEnabled') : t('app.android.wifiDisabled')));
  $('setAndroidAirplane').addEventListener('change', (e) => set('airplane', e.target.checked, e.target.checked ? t('app.android.airplaneOn') : t('app.android.airplaneOff')));
  $('setAndroidAnim').addEventListener('change', (e) => set('animations', e.target.checked, e.target.checked ? t('app.android.animOn') : t('app.android.animOff')));
  $('setAndroidFont').addEventListener('change', (e) => set('fontScale', Number(e.target.value), t('app.android.fontAdjusted')));
  $('setAndroidDensity').addEventListener('change', (e) => set('density', Number(e.target.value), t('app.android.densityAdjusted')));
  $('setAndroidVolume').addEventListener('input', (e) => {
    $('androidVolumeText').textContent = `${e.target.value}%`;
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => set('volume', Number(e.target.value), t('app.android.volumeAdjusted')), 260);
  });
  $('btnAndroidRefresh').addEventListener('click', () => refreshAndroid());
  $('btnAndroidTune').addEventListener('click', async () => {
    const r = await api.android.tune(state.launchPkg || '').catch(() => null);
    toast({ type: r && r.ok ? 'ok' : 'error', title: r && r.ok ? t('app.android.tuned') : t('app.android.tuneFailed') });
    if (r && r.ok) refreshAndroid();
  });
  const open = async (action) => {
    const r = await api.android.open(action).catch(() => null);
    if (!r || !r.ok) {
      toast({ type: 'error', title: t('app.android.needLaunchFirst') });
    }
  };
  $('btnAndroidSettings').addEventListener('click', () => open('settings'));
  $('btnAndroidDisplay').addEventListener('click', () => open('display'));
  $('btnAndroidSound').addEventListener('click', () => open('sound'));
  $('btnAndroidLocale').addEventListener('click', () => open('locale'));
  $('btnAndroidApps').addEventListener('click', () => open('apps'));
}

function fillSettings(s) {
  if ($('setLanguage')) $('setLanguage').value = s.language || 'auto';
  $('setEngineMode').value = s.engine.mode;
  $('setAdbPath').value = s.adbPath || '';
  $('setDevice').value = s.device || '';
  $('setSystemImage').value = s.runtime.isoPath || '';
  $('setMemory').value = s.engine.memoryMB;
  $('setCores').value = s.engine.cores;
  $('setIdle').value = s.engine.idleShutdownMinutes;
  if ($('setSourcePref')) $('setSourcePref').value = (s.runtime && s.runtime.sourcePreference) || 'auto';
  if ($('setAutoMirror')) $('setAutoMirror').checked = (s.runtime && s.runtime.autoMirror) !== false;
  if ($('setGiteeToken')) $('setGiteeToken').value = (s.runtime && s.runtime.giteeToken) || '';
  if ($('setMirrorPrefix')) $('setMirrorPrefix').value = (s.runtime && s.runtime.mirrorPrefix) || '';
  if ($('setConnections')) $('setConnections').value = Number((s.runtime && s.runtime.downloadConnections) || 8);
  $('setAudio').checked = s.engine.audio !== false;
  $('setLiteMode').checked = s.engine.liteMode !== false;
  $('setPrewarm').checked = s.engine.prewarm !== false;
  $('setPriorityMode').value = ['performance', 'game'].includes(s.engine.priorityMode)
    ? s.engine.priorityMode : 'balanced';
  $('setDeepTrim').checked = !!s.engine.deepTrim;
  $('setMouseRightBack').checked = s.engine.mouseRightBack !== false;
  $('setMouseWheelMode').value = ['smooth', 'native', 'off'].includes(s.engine.mouseWheelMode)
    ? s.engine.mouseWheelMode : 'smooth';
  $('setMouseSideButtons').checked = !!s.engine.mouseSideButtons;
  $('setCompat').checked = !!(s.runtime && s.runtime.compatImage);
  $('setAutoShortcut').checked = !!s.createShortcutOnInstall;
  $('setStartMenuShortcut').checked = s.createStartMenuShortcut !== false;
  $('setShortcutDir').value = s.shortcutDir || '';
  $('setSharedDir').value = s.sharedDir || '';
  $('setDeviceSharedDir').value = s.deviceSharedDir || '';
  const d = s.display || {};
  $('setAutoStart').checked = s.autoStart !== false;
  const eng = s.engine || {};
  if ($('setResourceMode')) $('setResourceMode').value = eng.resourceMode || 'balanced';
  if ($('setRenderSize')) $('setRenderSize').value = eng.renderSize || 'auto';
  if ($('setDataGB')) $('setDataGB').value = String(Number(eng.dataPartitionGB || 0));
  if ($('setFastDns')) $('setFastDns').checked = eng.fastDns !== false;
  if ($('setKeepSnapshot')) $('setKeepSnapshot').checked = eng.keepSnapshot !== false;
  $('setDisplayMode').value = d.mode === 'fullscreen' ? 'fullscreen' : 'window';
  $('setPortrait').value = d.portrait || '900x1600';
  $('portraitField').hidden = $('setDisplayMode').value === 'fullscreen';
}

/** 数据分区实际大小 + 磁盘余量，显示在设置页容量选择下方 */
async function refreshDataInfo() {
  const el = $('dataNote');
  if (!el) return;
  const info = await api.dataInfo().catch(() => null);
  if (!info) { el.textContent = t('app.data.readFailed'); return; }
  const auto = Number(($('setDataGB') || {}).value || 0) === 0;
  const img = info.imageGB ? `${info.imageGB} GB` : t('app.data.notCreated');
  const free = info.freeDiskMB ? `${(info.freeDiskMB / 1024).toFixed(1)} GB` : t('app.common.unknown');
  el.textContent = t('app.data.info', { img, auto: auto ? t('app.data.autoSuffix') : '', free })
    + t('app.data.infoHint');
}

async function openSettings() {
  state.settings = await api.getSettings();
  fillSettings(state.settings);
  const info = await api.info();
  $('setRuntimeDir').value = info.runtimeDir || info.dataDir;
  if ($('setAvdDir')) {
    const di = await api.dataInfo().catch(() => null);
    $('setAvdDir').value = (di && di.avdDir) || '';
  }
  const verEl = document.getElementById('aboutVer');
  if (verEl && info.version) verEl.textContent = `v${info.version}`;
  const curVerEl = document.getElementById('updateCurrent');
  if (curVerEl && info.version) curVerEl.textContent = `v${info.version}`;
  const assoc = await api.assocStatus();
  const btn = $('btnAssoc');
  btn.textContent = assoc.registered ? t('app.assoc.registered') : t('app.assoc.unregistered');
  btn.dataset.on = assoc.registered ? '1' : '0';

  api.doctorProfile().then((r) => {
    if (r && r.text) $('autoProfileText').textContent = r.text;
  }).catch(() => { $('autoProfileText').textContent = t('app.settings.autoMode'); });
  api.runtimeUsage().then((u) => {
    $('usageText').textContent = u
      ? t('app.usage.total', { total: u.totalText }) + (u.reclaimable ? t('app.usage.reclaimableSuffix', { reclaimable: u.reclaimableText, count: u.count }) : t('app.usage.cleanSuffix'))
      : t('app.usage.unavailable');
  }).catch(() => { $('usageText').textContent = t('app.usage.unavailable'); });

  $('settingsMask').classList.add('on');
  refreshAndroid();
  refreshDataInfo();
}

function closeSettings() {
  $('settingsMask').classList.remove('on');
}

/* ---------------- 软件更新 ---------------- */

let lastUpdate = null;

/** 把一次检查结果画到设置面板（也用于启动时静默检查推送过来的状态） */
function renderUpdate(info) {
  lastUpdate = info || null;
  const cur = $('updateCurrent');
  const st = $('updateState');
  const btn = $('btnDoUpdate');
  const bar = $('updateBar');
  if (!cur || !st || !btn) return;
  if (!info) return;
  if (info.current) cur.textContent = `v${info.current}`;

  if (info.ok === false) {
    st.textContent = t('app.update.checkFailed', { error: info.error || t('app.update.networkUnavailable') });
    // 检查失败也要给一条出路：直接把发布页打开，用户至少能手动下载。
    // 以前这里是「什么都不显示」，用户只会觉得「更新功能坏了」。
    showUpdateBtn(true);
    btn.textContent = t('app.update.openDownload');
    btn.dataset.mode = 'manual';
    lastUpdate = { htmlUrl: info.htmlUrl || '' };
    if (bar) bar.hidden = true;
    return;
  }
  if (info.hasUpdate) {
    // 如实说明这次是哪个源给出的版本、另一个源为什么没参与 ——
    // 用户排查「为什么检查更新很慢」时，这一行比任何日志都直接。
    const src = (info.sources || []).map((x) => `${x.name} ${x.tag || ''}`.trim()).join(' / ');
    const bad = (info.unreachable || []).map((x) => x.name).join(t('app.sep.list'));
    const stale = info.stale ? t('app.update.staleNote') : '';
    st.textContent = t('app.update.found', { tag: info.tag }) + (src ? t('app.update.sourceParen', { src }) : '') + (bad ? t('app.update.unreachableSuffix', { names: bad }) : '') + stale;
    showUpdateBtn(true);
    btn.textContent = info.asset ? t('app.update.updateNow') : t('app.update.openDownload');
    btn.dataset.mode = info.asset ? 'auto' : 'manual';
    const note = $('updateNote');
    if (note && info.notes) {
      const brief = String(info.notes).split('\n').slice(0, 8).join('\n').trim();
      if (brief) note.textContent = t('app.update.notes', { notes: brief });
    }
    if (bar) bar.hidden = true;
  } else {
    const src = (info.sources || []).map((x) => x.name).join(' / ');
    const stale = info.stale ? t('app.update.staleShort') : '';
    st.textContent = t('app.update.latest', { current: info.current }) + (src ? t('app.update.viaSuffix', { src }) : '') + stale;
    showUpdateBtn(false);
    if (bar) bar.hidden = true;
  }
}

/** .btn 自带 display:inline-flex，会盖掉 hidden 属性，所以这里直接改 display */
function showUpdateBtn(on) {
  const btn = $('btnDoUpdate');
  if (!btn) return;
  btn.hidden = !on;
  btn.style.display = on ? '' : 'none';
}

function renderUpdateProgress(p) {
  if (!p) return;
  const st = $('updateState');
  const bar = $('updateBar');
  const fill = $('updateBarFill');
  if (p.stage === 'error') {
    if (st) st.textContent = t('app.update.failed', { msg: p.message || '' });
    if (bar) bar.hidden = true;
    toast({ title: t('app.update.failedTitle'), body: p.message || '', type: 'error' });
    return;
  }
  if (st) st.textContent = p.message || t('app.update.updating');
  if (bar && fill) {
    bar.hidden = false;
    fill.style.width = `${Math.max(0, Math.min(100, p.percent || 0))}%`;
  }
}

function bindUpdate() {
  const check = $('btnCheckUpdate');
  const go = $('btnDoUpdate');
  if (!check || !go) return;

  const runCheck = async (silent) => {
    if (!silent) {
      check.disabled = true;
      const old = check.textContent;
      check.textContent = t('app.update.checking');
      $('updateState').textContent = t('app.update.connecting');
      try {
        const info = await api.updateCheck();
        renderUpdate(info);
        if (info && info.hasUpdate) toast({ title: t('app.update.found', { tag: info.tag }), body: t('app.update.foundToastBody'), type: 'info' });
        else if (info && info.ok !== false) toast({ title: t('app.update.latestTitle'), body: `v${info.current}`, type: 'ok' });
      } catch (e) {
        $('updateState').textContent = t('app.update.checkFailed', { error: e.message });
      } finally {
        check.disabled = false;
        check.textContent = old;
      }
      return;
    }
    const info = await api.updateCheck().catch(() => null);
    if (info) renderUpdate(info);
  };

  check.addEventListener('click', () => runCheck(false));

  go.addEventListener('click', async () => {
    if (go.dataset.mode === 'manual') {
      api.updateOpenRelease(lastUpdate && lastUpdate.htmlUrl);
      return;
    }
    go.disabled = true;
    go.textContent = t('app.update.updating');
    const r = await api.updateApply().catch((e) => ({ ok: false, error: e.message }));
    if (!r || !r.ok) {
      go.disabled = false;
      go.textContent = t('app.update.updateNow');
      if (r && r.error && !r.manual) {
        $('updateState').textContent = t('app.update.failed', { msg: r.error });
        toast({ title: t('app.update.failedTitle'), body: r.error, type: 'error' });
      }
    } else {
      $('updateState').textContent = t('app.update.downloaded', { version: r.version });
    }
  });

  // 打开设置时如果还没结果，就顺手查一次（放后台，不打扰）
  runCheck(true).catch(() => {});
}

function bindSettings() {
  const save = async (patch) => {
    state.settings = await api.setSettings(patch);
  };

  if ($('setLanguage')) {
    $('setLanguage').addEventListener('change', async (e) => {
      await save({ language: e.target.value });
      await applyLanguageChange();
    });
  }

  $('setEngineMode').addEventListener('change', (e) => save({ engine: { mode: e.target.value } }));
  $('setAdbPath').addEventListener('change', (e) => save({ adbPath: e.target.value.trim() }));
  $('setDevice').addEventListener('change', async (e) => {
    await save({ device: e.target.value.trim() });
    refreshStatus();
  });
  $('setSystemImage').addEventListener('change', (e) => save({ runtime: { isoPath: e.target.value.trim() } }));
  // 内存 / 核心：填了具体值就关掉「自动」，填 0 又回到自动。
  // 旧代码只写 memoryMB，而 overridesFromSettings 只在 autoMemory=false 时才认它，
  // 于是「手动填了内存」一直被忽略 —— 这是设置页最容易被当成“没用”的一项。
  $('setMemory').addEventListener('change', (e) => {
    const v = Number(e.target.value) || 0;
    save(v > 0 ? { engine: { memoryMB: v, autoMemory: false } } : { engine: { memoryMB: 0, autoMemory: true } });
  });
  $('setCores').addEventListener('change', (e) => {
    const v = Number(e.target.value) || 0;
    save(v > 0 ? { engine: { cores: v, autoMemory: false } } : { engine: { cores: 0, autoMemory: true } });
  });
  if ($('setResourceMode')) {
    $('setResourceMode').addEventListener('change', async (e) => {
      // 资源策略会连带改 liteMode / priorityMode / renderSize（主进程里翻译）
      state.settings = await api.setSettings({ engine: { resourceMode: e.target.value } });
      fillSettings(state.settings);
      toast({ title: t('app.settings.resourceSwitched'), body: t('app.settings.nextLaunch'), type: 'ok' });
    });
  }
  if ($('setRenderSize')) {
    $('setRenderSize').addEventListener('change', (e) => save({ engine: { renderSize: e.target.value } }));
  }
  if ($('setFastDns')) {
    $('setFastDns').addEventListener('change', (e) => save({ engine: { fastDns: e.target.checked } }));
  }
  if ($('setKeepSnapshot')) {
    $('setKeepSnapshot').addEventListener('change', (e) => save({ engine: { keepSnapshot: e.target.checked } }));
  }
  if ($('setDataGB')) {
    $('setDataGB').addEventListener('change', (e) => {
      save({ engine: { dataPartitionGB: Number(e.target.value) || 0 } });
      refreshDataInfo();
    });
  }
  if ($('btnGrowData')) {
    $('btnGrowData').addEventListener('click', async () => {
      const gb = Number($('setDataGB').value) || 0;
      if (!gb) { toast({ title: t('app.grow.chooseFirst'), body: t('app.grow.chooseFirstBody'), type: 'info' }); return; }
      const { response } = await api.confirm({
        title: t('app.grow.confirmTitle'),
        message: t('app.grow.confirmMessage', { gb }),
        detail: t('app.grow.confirmDetail'),
        okLabel: t('app.grow.confirmOk'),
      });
      if (response !== 1) return;
      $('btnGrowData').disabled = true;
      const old = $('btnGrowData').textContent;
      $('btnGrowData').textContent = t('app.grow.growing');
      const r = await api.setDataSize(gb).catch((e) => ({ ok: false, error: e.message }));
      $('btnGrowData').disabled = false;
      $('btnGrowData').textContent = old;
      toast({
        type: r && r.ok ? 'ok' : 'error',
        title: r && r.ok ? t('app.grow.done') : t('app.grow.failed'),
        body: r && r.ok ? t('app.grow.doneBody', { gb: r.imageGB || gb }) : (r && r.error) || t('app.error.unknown'),
      });
      refreshDataInfo();
    });
  }
  $('setIdle').addEventListener('change', (e) => save({ engine: { idleShutdownMinutes: Number(e.target.value) || 0 } }));
  if ($('setSourcePref')) {
    $('setSourcePref').addEventListener('change', (e) => save({ runtime: { sourcePreference: e.target.value } }));
  }
  if ($('setAutoMirror')) {
    $('setAutoMirror').addEventListener('change', (e) => save({ runtime: { autoMirror: e.target.checked } }));
  }
  if ($('setGiteeToken')) {
    $('setGiteeToken').addEventListener('change', (e) => save({ runtime: { giteeToken: e.target.value.trim() } }));
  }
  if ($('setMirrorPrefix')) {
    $('setMirrorPrefix').addEventListener('change', (e) => save({ runtime: { mirrorPrefix: e.target.value.trim() } }));
  }
  if ($('setConnections')) {
    $('setConnections').addEventListener('change', (e) => {
      const n = Math.max(1, Math.min(16, Number(e.target.value) || 8));
      e.target.value = n;
      save({ runtime: { downloadConnections: n } });
    });
  }
  $('setAudio').addEventListener('change', (e) => save({ engine: { audio: e.target.checked } }));
  $('setLiteMode').addEventListener('change', (e) => save({ engine: { liteMode: e.target.checked } }));
  $('setPrewarm').addEventListener('change', (e) => save({ engine: { prewarm: e.target.checked } }));
  $('setPriorityMode').addEventListener('change', (e) => save({ engine: { priorityMode: e.target.value } }));
  const savePointer = async (patch) => {
    await save({ engine: patch });
    // 立刻按当前窗口焦点重装/卸载钩子，不用等下次切窗口
    api.refreshPointerMapping().catch(() => {});
  };
  $('setMouseRightBack').addEventListener('change', (e) => savePointer({ mouseRightBack: e.target.checked }));
  $('setMouseWheelMode').addEventListener('change', (e) => savePointer({ mouseWheelMode: e.target.value }));
  $('setMouseSideButtons').addEventListener('change', (e) => savePointer({ mouseSideButtons: e.target.checked }));
  $('setDeepTrim').addEventListener('change', async (e) => {
    await save({ engine: { deepTrim: e.target.checked } });
    // 关掉深度裁剪必须把之前 pm disable-user 的包恢复回来，否则影响是持久的
    if (!e.target.checked) {
      api.restoreSystemApps().catch(() => {});
      toast({ title: t('app.settings.systemRestored'), body: t('app.settings.systemRestoredBody'), type: 'info' });
    }
  });
  $('setCompat').addEventListener('change', async (e) => {
    const on = e.target.checked;
    await save({ runtime: { compatImage: on } });
    const env = ((state.status = await api.runtimeStatus()).env) || {};
    const ok = env.playImage && env.playImage.ok;
    $('compatInstallField').hidden = !on || !!ok;
    if (on && !ok) toast({ title: t('app.compat.enabled'), body: t('app.compat.needDownload'), type: 'info' });
    else if (on) toast({ title: t('app.compat.enabled'), body: t('app.compat.restartNeeded'), type: 'info' });
  });
  $('setAutoShortcut').addEventListener('change', (e) => save({ createShortcutOnInstall: e.target.checked }));
  $('setStartMenuShortcut').addEventListener('change', (e) => save({ createStartMenuShortcut: e.target.checked }));
  $('setShortcutDir').addEventListener('change', (e) => save({ shortcutDir: e.target.value.trim() }));
  $('setDeviceSharedDir').addEventListener('change', (e) => save({ deviceSharedDir: e.target.value.trim() }));
  $('setAutoStart').addEventListener('change', (e) => save({ autoStart: e.target.checked }));
  $('setDisplayMode').addEventListener('change', async (e) => {
    const mode = e.target.value;
    $('portraitField').hidden = mode === 'fullscreen';
    state.settings = await api.setSettings({ display: { mode } });
    toast({ title: mode === 'fullscreen' ? t('app.display.fullscreen') : t('app.display.portrait'), type: 'ok' });
  });
  $('setPortrait').addEventListener('change', async (e) => {
    state.settings = await api.setSettings({ display: { portrait: e.target.value } });
    toast({ title: t('app.display.sizeUpdated'), body: t('app.display.sizeUpdatedBody'), type: 'ok' });
  });
  $('btnRebuildShortcuts').addEventListener('click', async () => {
    const r = await api.rebuildShortcuts();
    toast({
      title: r && r.fixed && r.fixed.length ? t('app.shortcuts.rebuilt') : t('app.shortcuts.allPresent'),
      body: r && r.fixed && r.fixed.length ? r.fixed.join(t('app.sep.list')) : t('app.shortcuts.allPresentBody'),
      type: 'ok',
    });
  });

  $('btnDiagnostics').addEventListener('click', async () => {
    try {
      const r = await api.doctorReport();
      toast({ title: t('app.diagnostics.exported'), body: `${r.diagnosis.title} · ${r.file}`, type: 'ok', sticky: true });
    } catch (e) {
      toast({ title: t('app.diagnostics.exportFailed'), body: e.message, type: 'error' });
    }
  });

  $('btnCleanup').addEventListener('click', async () => {
    const btn = $('btnCleanup');
    const includeSnapshots = $('chkCleanSnapshots') && $('chkCleanSnapshots').checked;
    btn.disabled = true;
    try {
      const preview = await api.runtimeCleanup({ apply: false, includeSnapshots });
      if (!preview.candidates.length) {
        toast({ title: t('app.cleanup.alreadyClean'), body: t('app.cleanup.alreadyCleanBody'), type: 'ok' });
        return;
      }
      const r = await api.runtimeCleanup({ apply: true, includeSnapshots });
      if (r.cancelled) return;
      toast({
        title: t('app.cleanup.done'),
        body: t('app.cleanup.doneBody', { mb: (r.saved / 1048576).toFixed(0), count: r.removed.length }),
        type: 'ok',
      });
      const u = await api.runtimeUsage();
      $('usageText').textContent = t('app.usage.summary', { total: u.totalText, reclaimable: u.reclaimableText, count: u.count });
    } catch (e) {
      toast({ title: t('app.cleanup.failed'), body: e.message, type: 'error' });
    } finally {
      btn.disabled = false;
    }
  });

  // 重置安卓数据：二级确认（先确认意图，再确认不可撤销），清完刷新占用统计
  $('btnResetData').addEventListener('click', async () => {
    const btn = $('btnResetData');
    btn.disabled = true;
    try {
      const first = await api.confirm({
        type: 'warning',
        title: t('app.reset.confirmTitle'),
        message: t('app.reset.confirmMessage'),
        detail: t('app.reset.confirmDetail'),
        buttons: [t('app.common.cancel'), t('app.common.continue')],
        defaultId: 0,
        cancelId: 0,
      });
      if (!first || first.response !== 1) return;
      const second = await api.confirm({
        type: 'warning',
        title: t('app.reset.confirm2Title'),
        message: t('app.reset.confirm2Message'),
        detail: t('app.reset.confirm2Detail'),
        buttons: [t('app.common.cancel'), t('app.reset.confirm2Ok')],
        defaultId: 0,
        cancelId: 0,
      });
      if (!second || second.response !== 1) return;
      const r = await api.runtimeResetData();
      if (!r || !r.ok) {
        toast({ title: t('app.reset.failed'), body: (r && r.error) || t('app.common.retry'), type: 'error' });
        return;
      }
      toast({
        title: t('app.reset.done'),
        body: t('app.reset.doneBody', { mb: r.reclaimedMB }),
        type: 'ok',
      });
      const u = await api.runtimeUsage();
      $('usageText').textContent = t('app.usage.summary', { total: u.totalText, reclaimable: u.reclaimableText, count: u.count });
    } catch (e) {
      toast({ title: t('app.reset.failed'), body: e.message, type: 'error' });
    } finally {
      btn.disabled = false;
    }
  });

  // 修复网络：安卓里联网页面一直黑屏（红果点「同意并继续」后整屏黑）时用。
  // 根因是虚拟机 /data 里的 Wi-Fi 配置坏了，wlan0 没起来、没有默认路由。
  // Play Store 镜像不允许 root，只能整体重置 /data；应用清单保留，点开时会自动重装。
  $('btnRepairNetwork').addEventListener('click', async () => {
    const btn = $('btnRepairNetwork');
    btn.disabled = true;
    try {
      const ok = await api.confirm({
        type: 'warning',
        title: t('app.repair.title'),
        message: t('app.repair.message'),
        detail: t('app.repair.detail'),
        buttons: [t('app.common.cancel'), t('app.repair.ok')],
        defaultId: 0,
        cancelId: 0,
      });
      if (!ok || ok.response !== 1) return;
      const r = await api.runtimeRepairNetwork();
      if (!r || !r.ok) {
        toast({
          title: t('app.repair.stillDown'),
          body: (r && r.error) || t('app.repair.stillDownFallback'),
          type: 'error',
        });
        return;
      }
      toast({
        title: t('app.repair.done'),
        body: `${(r.network && r.network.ip) || t('app.repair.connected')}${r.wiped ? t('app.repair.wipedSuffix') : t('app.repair.keptSuffix')}`,
        type: 'ok',
      });
    } catch (e) {
      toast({ title: t('app.repair.failed'), body: e.message, type: 'error' });
    } finally {
      btn.disabled = false;
    }
  });

  // 清理旧版本残留：扫描旧程序目录 / 失效卸载项 / 更新临时文件，确认后一次性清掉。
  $('btnLeftovers').addEventListener('click', async () => {
    const btn = $('btnLeftovers');
    btn.disabled = true;
    try {
      const r = await api.leftoversScan();
      if (!r || !r.ok) {
        toast({ title: t('app.leftovers.scanFailed'), body: (r && r.error) || t('app.common.retry'), type: 'error' });
        return;
      }
      const items = r.items || [];
      if (!items.length) {
        toast({ title: t('app.leftovers.cleanTitle'), body: t('app.leftovers.cleanBody'), type: 'ok' });
        return;
      }
      const mb = Math.round((r.totalBytes || 0) / 1048576);
      const lines = items.slice(0, 8).map((x) => t('app.leftovers.line', { note: x.note, path: x.path }));
      if (items.length > 8) lines.push(t('app.leftovers.more', { count: items.length - 8 }));
      const ok = await api.confirm({
        type: 'warning',
        title: t('app.leftovers.confirmTitle'),
        message: t('app.leftovers.confirmMessage', { count: items.length, mb }),
        detail: t('app.leftovers.confirmDetail', { lines: lines.join('\n') }),
        buttons: [t('app.common.cancel'), t('app.leftovers.confirmOk')],
        defaultId: 1,
        cancelId: 0,
      });
      if (!ok || ok.response !== 1) return;
      const c = await api.leftoversClean(items);
      if (!c || !c.ok) {
        toast({ title: t('app.cleanup.failed'), body: (c && c.error) || t('app.common.retry'), type: 'error' });
        return;
      }
      const failNote = (c.failed && c.failed.length) ? t('app.leftovers.failNote', { count: c.failed.length }) : '';
      toast({
        title: t('app.leftovers.done'),
        body: t('app.leftovers.doneBody', { count: c.removed.length, mb: c.freedMB || 0, failNote }),
        type: 'ok',
      });
      const u = await api.runtimeUsage();
      $('usageText').textContent = t('app.usage.summary', { total: u.totalText, reclaimable: u.reclaimableText, count: u.count });
    } catch (e) {
      toast({ title: t('app.cleanup.failed'), body: e.message, type: 'error' });
    } finally {
      btn.disabled = false;
    }
  });

  $('btnOpenShared').addEventListener('click', () => api.openSharedDir());

  // 重建快捷方式：桌面图标被误删 / 被安全软件拦掉时的兜底入口
  $('btnRebuildShortcuts').addEventListener('click', async () => {
    const btn = $('btnRebuildShortcuts');
    btn.disabled = true;
    try {
      const r = await api.rebuildShortcuts().catch(() => ({ ok: false }));
      const fixed = (r && r.fixed) || [];
      toast(fixed.length
        ? { title: t('app.shortcuts.rebuiltAlt'), body: fixed.join(t('app.sep.list')), type: 'ok' }
        : { title: t('app.shortcuts.allThere'), body: t('app.shortcuts.allThereBody'), type: 'info' });
    } finally {
      btn.disabled = false;
    }
  });

  // 共享目录：先浏览选目录，再「保存并迁移」把旧文件一次性搬到新目录
  $('btnBrowseShared').addEventListener('click', async () => {
    const picked = await api.openDir();
    if (!picked) return;
    $('setSharedDir').value = picked;
    toast({ title: t('app.shared.picked'), body: t('app.shared.pickedBody'), type: 'info' });
  });
  $('btnSaveShared').addEventListener('click', async () => {
    const dir = $('setSharedDir').value.trim();
    if (!dir) { toast({ title: t('app.shared.needDir'), type: 'error' }); return; }
    const btn = $('btnSaveShared');
    btn.disabled = true;
    const r = await api.setSharedDir(dir).catch(() => ({ ok: false }));
    btn.disabled = false;
    if (r.ok) {
      const moved = r.oldDir && r.oldDir !== r.newDir;
      toast({ title: t('app.shared.updated'), body: moved ? t('app.shared.moved') : t('app.common.saved'), type: 'ok' });
    } else {
      toast({ title: t('app.shared.saveFailed'), body: r.error, type: 'error' });
    }
  });

  // 一键卸载 ApkStart 本体（取消 .apk 关联 + 启动卸载程序；便携版手动删除）
  $('btnUninstall').addEventListener('click', async () => {
    const ok = window.confirm(t('app.selfUninstall.confirm'));
    if (!ok) return;
    const btn = $('btnUninstall');
    btn.disabled = true;
    const r = await api.removeSelf().catch(() => ({ ok: false }));
    if (r.ok && r.portable) {
      btn.disabled = false;
      toast({
        title: t('app.selfUninstall.portableTitle'),
        body: t('app.selfUninstall.portableBody', { exeDir: r.exeDir, dataDir: r.dataDir }),
        type: 'info', sticky: true,
      });
      return;
    }
    if (!r.ok) {
      btn.disabled = false;
      toast({ title: t('app.uninstall.failed'), body: r.error, type: 'error' });
      return;
    }
    toast({ title: t('app.selfUninstall.uninstalling'), body: t('app.selfUninstall.uninstallingBody'), type: 'ok', sticky: true });
  });

  // ARM 兼容镜像下载（带进度 toast）
  $('btnInstallPlay').addEventListener('click', async () => {
    const btn = $('btnInstallPlay');
    btn.disabled = true;
    const t = toast({ title: window.I18n.t('app.play.startTitle'), body: window.I18n.t('app.common.preparing'), sticky: true, spinner: true, progress: 3 });
    const un = api.on('provision:progress', (p) => {
      if (p.component !== 'playimg') return;
      t.update({ title: window.I18n.t('app.play.downloadingTitle'), body: p.message || '', progress: p.percent });
    });
    try {
      const r = await api.installPlayImage();
      if (r && r.ok) {
        t.update({ title: window.I18n.t('app.play.ready'), body: window.I18n.t('app.compat.restartNeeded'), progress: 100 });
        setTimeout(() => t.dismiss(), 3000);
        $('compatInstallField').hidden = true;
        refreshStatus();
      } else {
        t.update({ title: window.I18n.t('app.play.failed'), body: (r && r.error) || window.I18n.t('app.error.unknown'), progress: null });
        t.dismiss();
        toast({ title: window.I18n.t('app.play.failed'), body: (r && r.error) || window.I18n.t('app.error.unknown'), type: 'error' });
      }
    } catch (e) {
      t.dismiss();
      toast({ title: t('app.play.failed'), body: e.message, type: 'error' });
    } finally {
      un();
      btn.disabled = false;
    }
  });

  // 兼容镜像状态显示
  (async () => {
    const env = ((state.status = await api.runtimeStatus()).env) || {};
    const s = state.settings;
    const on = !!(s && s.runtime && s.runtime.compatImage);
    const ok = env.playImage && env.playImage.ok;
    $('compatInstallField').hidden = !on || !!ok;
    if (env.playImage) {
      $('compatImgStatus').textContent = ok
        ? t('app.compat.readySize', { size: (env.playImage.size / 1073741824).toFixed(2) }) : t('app.compat.notDownloaded');
    }
  })();
  $('btnOpenData').addEventListener('click', async () => {
    const info = await api.info();
    const dir = info.runtimeDir || info.dataDir;
    window.open(`file:///${dir.replace(/\\/g, '/')}`);
  });
  $('btnBrowseRuntimeDir').addEventListener('click', async () => {
    const info = await api.info();
    const picked = await api.openDir();
    if (!picked) return;
    await api.setSettings({ runtime: { dir: picked } });
    $('setRuntimeDir').value = picked;
    toast({ title: t('app.dir.runtimeUpdated'), body: t('app.dir.runtimeUpdatedBody'), type: 'ok', sticky: true });
  });

  // 安卓数据目录（AVD + 快照）：真正吃盘的那块，单独指到别的盘
  if ($('btnBrowseAvdDir')) {
    $('btnBrowseAvdDir').addEventListener('click', async () => {
      const picked = await api.openDir();
      if (!picked) return;
      await api.setSettings({ runtime: { avdDir: picked } });
      $('setAvdDir').value = picked;
      toast({
        title: t('app.dir.avdUpdated'),
        body: t('app.dir.avdUpdatedBody'),
        type: 'ok',
        sticky: true,
      });
    });
  }
  if ($('btnOpenAvdDir')) {
    $('btnOpenAvdDir').addEventListener('click', async () => {
      const info = await api.dataInfo().catch(() => null);
      const dir = (info && info.avdDir) || (await api.info()).dataDir;
      window.open(`file:///${String(dir).replace(/\\/g, '/')}`);
    });
  }

  $('btnProbe').addEventListener('click', async () => {
    const el = $('probeResult');
    el.textContent = t('app.probe.probing');
    const found = await api.runtimeProbe();
    if (!found.length) {
      el.textContent = t('app.probe.none');
      return;
    }
    el.textContent = t('app.probe.found', { names: found.map((f) => f.name).join(t('app.sep.list')) });
    await api.setSettings({ device: found[0].serial });
    $('setDevice').value = found[0].serial;
    refreshStatus();
  });

  $('btnRuntimeStart').addEventListener('click', async () => {
    const el = $('probeResult');
    el.textContent = t('app.runtime.starting');
    const r = await api.runtimeStart();
    el.textContent = r.ok ? t('app.runtime.readyEngine', { engine: r.engine }) : t('app.runtime.startFailed', { error: r.error });
    refreshStatus();
  });

  $('btnRuntimeStop').addEventListener('click', async () => {
    await api.runtimeStop();
    $('probeResult').textContent = t('app.runtime.stoppedVm');
    refreshStatus();
  });

  $('btnAssoc').addEventListener('click', async () => {
    const btn = $('btnAssoc');
    if (btn.dataset.on === '1') {
      await api.assocUnregister();
      btn.textContent = t('app.assoc.unregistered');
      btn.dataset.on = '0';
      toast({ title: t('app.assoc.cancelledToast') });
    } else {
      const r = await api.assocRegister();
      btn.textContent = t('app.assoc.registered');
      btn.dataset.on = '1';
      toast({ title: t('app.assoc.enabledToast'), body: r.ok ? t('app.assoc.enabledBody') : '', type: r.ok ? 'ok' : 'error' });
    }
  });
}

/* ---------------- 事件绑定 ---------------- */

function bindEvents() {
  // 链接统一走系统浏览器
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="http"]');
    if (!a) return;
    e.preventDefault();
    api.openExternal(a.getAttribute('href'));
  });

  $('btnSettings').addEventListener('click', openSettings);
  // 状态标签也当入口：点「需要部署 / 引导中 / Android 14」直接进设置的运行时面板
  $('engineTag').addEventListener('click', () => showSetup(true));
  $('btnCloseSettings').addEventListener('click', closeSettings);
  $('btnDoneSettings').addEventListener('click', closeSettings);
  $('settingsMask').addEventListener('click', (e) => {
    if (e.target === $('settingsMask')) closeSettings();
  });

  // 运行时部署：入口已收进设置，这里只处理面板内的按钮
  $('btnDeployAll').addEventListener('click', deployAll);
  $('btnMarkInstalled').addEventListener('click', markInstalled);
  $('btnGuideClose').addEventListener('click', () => { $('setupGuide').hidden = true; });
  $('btnSetupAdvanced').addEventListener('click', () => {
    const adv = document.querySelector('.advanced-group');
    if (adv) {
      adv.open = true;
      adv.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });

  // 状态条上的自检计数：点开就是设置里的运行时面板
  $('envChip').addEventListener('click', () => {
    openSettings().then(() => {
      const box = $('envCheck');
      if (box && !box.hidden) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      else $('runtimeGroup').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }).catch(() => {});
  });

  $('setupSteps').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    if (act === 'emulator' || act === 'sysimg' || act === 'accel'
      || act === 'adb' || act === 'qemu' || act === 'iso' || act === 'disk') {
      const r = await runStep(act);
      if (!r.ok) toast({ title: t('app.operation.failed'), body: r.error, type: 'error', sticky: true });
      return;
    }
    if (act === 'isoImport') {
      const r = await api.importIso();
      if (r.ok) { toast({ title: t('app.import.sysimgDone'), body: r.path, type: 'ok' }); refreshStatus(); }
      else if (!r.canceled) toast({ title: t('app.import.failed'), body: r.error, type: 'error' });
      return;
    }
    if (act === 'diskImport') {
      const r = await api.importDisk();
      if (r.ok) { toast({ title: t('app.import.diskDone'), body: t('app.import.diskDoneBody'), type: 'ok' }); refreshStatus(); }
      else if (!r.canceled) toast({ title: t('app.import.failed'), body: r.error, type: 'error' });
      return;
    }
    if (act === 'install') { await startInstall(); return; }
    if (act === 'vmStart') {
      const t = toast({ title: window.I18n.t('app.runtime.startingToast'), body: window.I18n.t('app.runtime.startingToastBody'), sticky: true, spinner: true });
      const r = await api.runtimeStart();
      if (r.ok) { t.update({ title: window.I18n.t('app.runtime.readyTitle'), type: 'ok' }); setTimeout(t.dismiss, 2200); }
      else t.update({ title: window.I18n.t('app.launch.failed'), body: r.error, type: 'error' });
      refreshStatus();
      return;
    }
    if (act === 'vmStop') {
      await api.runtimeStop();
      toast({ title: t('app.runtime.sessionEnded') });
      refreshStatus();
    }
  });

  const pick = async () => {
    const files = await api.pickApk();
    if (files.length) installFiles(files);
  };
  $('btnInstall').addEventListener('click', pick);
  $('btnInstall2').addEventListener('click', pick);
  // 共享目录入口移到设置里：同步 + 打开都在「文件互通」组内
  const btnSync = $('btnSyncShared');
  if (btnSync) btnSync.addEventListener('click', async () => {
    btnSync.disabled = true;
    try {
      await api.syncShared();
      toast({ title: t('app.shared.synced'), type: 'ok' });
    } catch (_) {
      toast({ title: t('app.shared.syncFailed'), body: t('app.shared.syncFailedBody'), type: 'error' });
    } finally {
      btnSync.disabled = false;
    }
  });

  $('search').addEventListener('input', (e) => {
    state.filter = e.target.value;
    renderGrid();
  });

  $('grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) launchApp(card.dataset.pkg);
  });

  $('grid').addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY, card.dataset.pkg);
  });

  $('grid').addEventListener('dblclick', (e) => {
    const card = e.target.closest('.card');
    if (card) createShortcut(card.dataset.pkg);
  });

  $('ctxmenu').addEventListener('click', (e) => {
    const item = e.target.closest('.item');
    if (item) handleMenu(item.dataset.act);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#ctxmenu')) hideMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideMenu();
      closeSettings();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      $('search').focus();
    }
  });

  // 拖放安装
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    $('dropzone').classList.add('on');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) $('dropzone').classList.remove('on');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    $('dropzone').classList.remove('on');
    const files = [...(e.dataTransfer?.files || [])];
    const paths = files
      .map((f) => { try { return api.pathForFile(f); } catch (_) { return null; } })
      .filter((p) => p && /\.apk$/i.test(p));
    if (paths.length) installFiles(paths);
    else toast({ title: t('app.drop.onlyApk'), type: 'error' });
  });

  // 主进程事件
  api.on('install:error', (p) => {
    // 报错了就别再让「正在安装…」那条一直转圈（可能来自双击 APK 的另一条链路）
    if (installToast) { try { installToast.dismiss(); } catch (_) { /* ignore */ } installToast = null; }
    const name = p && p.file ? String(p.file).split(/[\\/]/).pop() : '';
    toast({
      title: name ? t('app.install.failedWithName', { name }) : t('app.install.failed'),
      body: friendlyInstallErrorText((p && p.message) || t('app.error.unknown')),
      type: 'error',
    });
  });
  api.on('toast', (p) => toast({ title: p.message, type: p.type === 'error' ? 'error' : 'info' }));
  api.on('app:launched', () => setTimeout(refreshApps, 800));
  api.on('runtime:log', (m) => console.log('[runtime]', m));
  api.on('ui:navigate', (v) => {
    if (v === 'settings') openSettings();
    if (v === 'setup') { showSetup(true); refreshStatus(); }
  });
  api.on('provision:progress', (p) => updateStepProgress(p.component, p));
  api.on('update:state', (info) => {
    if (!info) return;
    renderUpdate(info);
    // 启动 8 秒后才拿到更新信息：欢迎卡若还开着，把「发现新版本」这条补进去
    const wm = $('welcomeMask');
    if (wm && !wm.hidden) renderWelcomeTips();
  });
  api.on('update:progress', (p) => renderUpdateProgress(p));
  api.on('i18n:changed', () => { applyLanguageChange().catch(() => {}); });
}

/* ---------------- 语言切换 ---------------- */

/** 语言变更后重渲染所有 JS 动态文本（静态文本由 I18n.refresh 内部的 apply 处理） */
async function applyLanguageChange() {
  await window.I18n.refresh(api);
  renderGrid();
  updateStats();
  await refreshStatus();
  if (state.settings) fillSettings(state.settings);
  const btn = $('btnAssoc');
  if (btn && btn.dataset.on) btn.textContent = btn.dataset.on === '1' ? t('app.assoc.registered') : t('app.assoc.unregistered');
  if (lastUpdate) renderUpdate(lastUpdate);
  const wm = $('welcomeMask');
  if (wm && !wm.hidden) renderWelcomeTips();
  refreshDataInfo();
  selfCheck();
}

/* ---------------- 启动 ---------------- */

async function init() {
  await window.I18n.init(api);
  bindEvents();
  bindSettings();
  bindUpdate();
  bindAndroid();
  bindWelcome();
  state.settings = await api.getSettings();
  await refreshStatus();
  await refreshApps();
  refreshAndroid();
  selfCheck();
  maybeShowWelcome();
  setInterval(refreshStatus, 6000);
  setInterval(refreshApps, 15000);
  setInterval(selfCheck, 60000);
}

/* ---------------- 启动欢迎卡 ---------------- */

let startupInfo = null;

function greetingOf(h) {
  if (h < 5) return t('app.welcome.greetLate');
  if (h < 11) return t('app.welcome.greetMorning');
  if (h < 13) return t('app.welcome.greetNoon');
  if (h < 18) return t('app.welcome.greetAfternoon');
  return t('app.welcome.greetEvening');
}

function bindWelcome() {
  const mask = $('welcomeMask');
  if (!mask) return;
  const close = () => { mask.hidden = true; };
  const never = $('welcomeNever');
  $('welcomeOk').addEventListener('click', () => {
    if (never && never.checked) api.setSettings({ welcome: { disabled: true } }).catch(() => {});
    close();
  });
  $('welcomeSettings').addEventListener('click', () => { close(); openSettings(); });
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mask.hidden) close(); });
}

/** 决定要不要弹：开机自启必弹；手动打开则每天最多一次，且用户可永久关闭 */
async function maybeShowWelcome() {
  const mask = $('welcomeMask');
  if (!mask) return;
  // 冒烟截图时不要弹欢迎卡：否则每次自动截图都被它挡住主界面
  try { if ((await api.startupInfo()).smoke) return; } catch (_) { /* ignore */ }
  try { startupInfo = await api.startupInfo(); } catch (_) { startupInfo = null; }
  const cfg = (state.settings && state.settings.welcome) || {};
  if (cfg.disabled) return;
  const today = new Date().toISOString().slice(0, 10);
  if (!(startupInfo && startupInfo.autostart) && cfg.lastDate === today) return;

  const h = new Date().getHours();
  $('welcomeHi').textContent = t('app.welcome.hi', { greeting: greetingOf(h) });
  const ver = (startupInfo && startupInfo.version) || (state.status && state.status.version) || '';
  const ready = state.status && state.status.ready;
  $('welcomeSub').textContent = t('app.welcome.sub', { version: ver ? ` v${ver}` : '', status: t(ready ? 'app.welcome.ready' : 'app.welcome.autoPrepare') });

  const apps = (state.apps || []).length;
  const dev = $('statusDevice') ? $('statusDevice').textContent.trim() : '';
  const chips = [
    { k: String(apps), v: t('app.welcome.statApps') },
    { k: ready ? t('app.welcome.statReady') : t('app.welcome.statStandby'), v: t('app.welcome.statRuntime') },
    { k: dev ? dev.replace(/^.*?(\d+)/, '$1') : '—', v: t('app.welcome.statDevice') },
  ];
  $('welcomeStats').innerHTML = chips
    .map((c) => `<div class="welcome-stat"><b>${esc(c.k)}</b><span>${esc(c.v)}</span></div>`)
    .join('');

  const tips = [];
  $('welcomeTips').innerHTML = '';
  mask.hidden = false;
  renderWelcomeTips();
  api.setSettings({ welcome: { lastDate: today } }).catch(() => {});
}

/** 提示区单独渲染：启动 8 秒后才拿到更新信息，那时卡片可能还开着，需要补一次 */
function renderWelcomeTips() {
  const box = $('welcomeTips');
  if (!box) return;
  const apps = (state.apps || []).length;
  const tips = [];
  if (lastUpdate && lastUpdate.hasUpdate) {
    tips.push(t('app.welcome.tipUpdate', { tag: esc(lastUpdate.tag || '') }));
  }
  if (!apps) {
    tips.push(t('app.welcome.tipInstall'));
  } else {
    tips.push(t('app.welcome.tipRun'));
  }
  tips.push(t('app.welcome.tipClose'));
  box.innerHTML = tips
    .map((t, i) => `<div class="welcome-tip"><i>${i + 1}</i><span>${t}</span></div>`)
    .join('');
}

/* ---------------- 环境自检 ---------------- */

let envBusy = false;

/** 拉取 doctor:selfCheck：把问题渲染到设置里的自检面板，并在状态条上留一个计数 */
async function selfCheck() {
  if (envBusy) return;
  envBusy = true;
  try {
    const r = await api.selfCheck().catch(() => null);
    if (r) renderEnvCheck(r);
  } catch (_) { /* 自检失败不阻断主流程 */ }
  finally { envBusy = false; }
}

function renderEnvCheck(r) {
  const box = $('envCheck');
  if (!box) return;
  // 「组件缺失」在同一个面板的一键完成里已经覆盖，不再重复列出
  const needDeploy = !!(state.status && state.status.needsSetup);
  const issues = (r.issues || []).filter((i) => !(needDeploy && i.fix === 'deploy'));

  // 主界面不再放横幅：只在底部状态条上留一个可点的计数，点开就是设置里的自检面板
  const chip = $('envChip');
  if (chip) {
    const errs = issues.filter((i) => i.severity === 'error').length;
    chip.hidden = issues.length === 0;
    chip.textContent = errs ? t('app.env.chipErrors', { count: errs }) : t('app.env.chipHints', { count: issues.length });
    chip.className = `status-chip${errs ? ' err' : ''}`;
    chip.title = issues.map((i) => i.title).join(t('app.sep.semi'));
  }

  if (!issues.length) {
    box.hidden = false;
    box.innerHTML = `
      <div class="env-check-ok">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
        <span>${t('app.env.okText')}</span>
        <span style="flex:1"></span>
        <button class="btn ghost sm" id="btnEnvRecheck">${t('app.env.recheck')}</button>
      </div>`;
    const re = $('btnEnvRecheck');
    if (re) re.addEventListener('click', selfCheck);
    return;
  }
  const errs = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.length - errs;
  box.hidden = false;
  box.innerHTML = `
    <div class="env-check-head">
      <span class="ec-title">${t('app.env.title')}</span>
      ${errs ? `<span class="ec-count">${t('app.env.severeCount', { count: errs })}</span>` : ''}
      ${warns ? `<span class="ec-count warn">${t('app.env.warnCount', { count: warns })}</span>` : ''}
      <span class="ec-spacer"></span>
      <button class="btn ghost sm" id="btnEnvRecheck">${t('app.env.recheck')}</button>
      <button class="btn primary sm" id="btnEnvFixAll">${t('app.env.fixAll')}</button>
    </div>
    <div class="env-check-list">
      ${issues.map((i) => `
        <div class="env-check-item ${i.severity}">
          <span class="ec-sev"></span>
          <div class="ec-body">
            <div class="ec-name">${esc(i.title)}</div>
            <div class="ec-hint">${esc(i.hint || '')}</div>
          </div>
          ${i.fix ? `<button class="ec-fix" data-code="${esc(i.code)}">${t('app.env.fix')}</button>` : ''}
        </div>`).join('')}
    </div>`;
  const re = $('btnEnvRecheck');
  if (re) re.addEventListener('click', selfCheck);
  const fixAll = $('btnEnvFixAll');
  if (fixAll) fixAll.addEventListener('click', () => fixAllIssues(issues));
  box.querySelectorAll('.ec-fix').forEach((b) => {
    b.addEventListener('click', () => {
      const issue = issues.find((x) => x.code === b.dataset.code);
      if (issue) fixIssue(issue);
    });
  });
}

async function fixIssue(issue) {
  switch (issue.fix) {
    case 'vcRedist': {
      const r = await api.installVcRedist().catch(() => ({ ok: false }));
      if (!r.ok && r.reason === 'no-installer') {
        api.openExternal('https://learn.microsoft.com/zh-CN/cpp/windows/latest-supported-vc-redist?view=msvc-170#visual-studio-2015-2017-2019-and-2022');
        toast({ title: t('app.fix.vcNoInstaller'), body: t('app.fix.vcNoInstallerBody'), type: 'info' });
        break;
      }
      toast(r.ok
        ? { title: t('app.fix.vcDone'), type: 'ok' }
        : { title: t('app.fix.vcIncomplete'), body: r.error || t('app.common.retry'), type: 'error' });
      break;
    }
    case 'virtualization': {
      const t = toast({ title: window.I18n.t('app.fix.virtStarting'), body: window.I18n.t('app.accel.installingBody'), sticky: true, spinner: true });
      const r = await api.enableVirtualization().catch(() => ({ ok: false }));
      if (r.ok) {
        t.update({ title: window.I18n.t('app.accel.enabled'), body: r.restartNeeded ? window.I18n.t('app.fix.virtRestart') : (r.note || ''), type: 'ok' });
        setTimeout(t.dismiss, 3200);
      } else {
        t.update({ title: window.I18n.t('app.fix.virtFailed'), body: r.error || window.I18n.t('app.common.retry'), type: 'error', sticky: true });
      }
      break;
    }
    case 'disk': {
      // 主进程会弹出原生确认框（含可释放空间预览），这里不再重复 confirm
      const r = await api.runtimeCleanup({ apply: true }).catch(() => null);
      if (!r) { toast({ title: t('app.cleanup.failed'), body: t('app.common.retry'), type: 'error' }); break; }
      if (r.cancelled) break;
      toast({ title: t('app.cleanup.done'), body: t('app.cleanup.freedBody', { mb: ((r.saved || 0) / 1048576).toFixed(0) }), type: 'ok' });
      break;
    }
    case 'path': {
      toast({ title: t('app.fix.pathTitle'), body: t('app.fix.pathBody'), type: 'info', sticky: true });
      openSettings();
      break;
    }
    case 'deploy': {
      toast({ title: t('app.fix.deploying'), type: 'info', sticky: true, spinner: true });
      await deployAll();
      break;
    }
    case 'lock': {
      const r = await api.clearLocks().catch(() => ({ ok: false }));
      toast(r.ok ? { title: t('app.fix.lockCleared'), type: 'ok' } : { title: t('app.cleanup.failed'), body: r.error, type: 'error' });
      break;
    }
    default:
      toast({ title: t('app.fix.unsupported'), body: issue.hint || '', type: 'info' });
  }
  // 修复后重新自检，刷新横幅与状态
  setTimeout(selfCheck, 600);
  setTimeout(refreshStatus, 600);
}

async function fixAllIssues(issues) {
  const fixable = issues.filter((i) => i.fix);
  for (const i of fixable) {
    // eslint-disable-next-line no-await-in-loop
    await fixIssue(i);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, 500));
  }
}

init().catch((e) => {
  console.error(e);
  toast({ title: t('app.init.failed'), body: e.message, type: 'error', sticky: true });
});
