/* Illustrated chapters and the optional, on-demand plan-relief. */
(function () {
  'use strict';
  const atlas = document.getElementById('relief');
  if (!atlas) return;
  const byId = id => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const leaves = new Map();
  let manualChapter = '';

  function markManual(node) {
    manualChapter = node.closest('section.chapter')?.id || '';
  }

  for (const leaf of document.querySelectorAll('[data-leaf]')) {
    const image = leaf.querySelector('img');
    const choices = [...leaf.querySelectorAll('[data-image]')];
    const note = leaf.querySelector('.relief-leaf__note');
    const group = leaf.querySelector('[role=group]');
    let version = 0;
    async function select(index) {
      const choice = choices[index];
      const current = ++version;
      if (image.getAttribute('src') === choice.dataset.image) {
        note.textContent = choice.dataset.note;
        return;
      }
      const next = new Image();
      next.src = choice.dataset.image;
      try { await next.decode(); }
      catch { if (current === version) note.textContent = 'Cette vue n’a pas pu être chargée. Vous pouvez réessayer.'; return; }
      if (current !== version) return;
      image.src = choice.dataset.image;
      image.alt = choice.dataset.alt;
      note.textContent = choice.dataset.note;
      choices.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
      leaf.querySelectorAll('[data-on-view]').forEach(pin=>pin.hidden=Number(pin.dataset.onView)!==index);
      if (!reduced.matches && image.animate) image.animate([{opacity:.6},{opacity:1}],{duration:220});
    }
    choices.forEach((button,i)=>button.addEventListener('click',()=>{markManual(leaf);select(i);}));
    group.hidden = false;
    leaves.set(leaf.id,select);
  }

  const stage=byId('relief-stage'), plate=byId('relief-plate'), other=byId('relief-reference');
  const compare=byId('relief-compare'), explore=byId('relief-orbit'), camera=byId('relief-camera');
  const range=byId('relief-range'), host=byId('relief-canvas'), status=byId('relief-status');
  const buttons=[...atlas.querySelectorAll('[data-period]')];
  const notes=[...atlas.querySelectorAll('[data-period-note]')];
  const labels=new Map(buttons.map(b=>[b.dataset.period,b.textContent]));
  const markers={
    golfe:[[40.526,41.43],[44.507,70.508]],
    ville:[[46.273,27.865],[69.41,71.528]]
  };
  let period='terrier', frame='golfe', mode='plate', controller, viewer;
  function setMarker(el,coord,label) {
    el.style.left=coord[0]+'%'; el.style.top=coord[1]+'%'; el.textContent=label;
  }
  function setSplit() {
    stage.style.setProperty('--split',range.value+'%');
    range.setAttribute('aria-valuetext',range.value+' % pour '+labels.get(period));
  }
  function chooseImage(image,era) {
    const src='assets/relief/'+frame+'-'+era+'.webp';
    if(image.getAttribute('src')!==src) image.src=src;
  }
  function update() {
    const paired=mode==='compare', orbiting=mode==='orbit', loading=mode==='loading';
    const town=frame==='ville', reference=period==='2024'?'1975':'2024';
    stage.dataset.mode=mode;
    const note=notes.find(el=>el.dataset.periodNote===period);
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===period)));
    notes.forEach(el=>el.hidden=el!==note);
    chooseImage(plate,period);
    plate.alt=(town?'Détail de la vieille ville. ':'Vue du golfe. ')+labels.get(period)+'. '+note.querySelector('p').textContent;
    setMarker(byId('relief-hill'),markers[frame][0],'La vieille ville');
    setMarker(byId('relief-water'),markers[frame][1],town?(period==='terrier'||period==='1951'?'L’anse':'Le port'):(period==='terrier'?'Le marais':'Les salines'));
    camera.setAttribute('aria-pressed',String(town));
    camera.textContent=town?'Revenir au golfe':'Voir la vieille ville';
    compare.setAttribute('aria-pressed',String(paired));
    compare.textContent=paired?'Fermer la comparaison':'Comparer avec '+labels.get(reference);
    explore.setAttribute('aria-pressed',String(loading||orbiting));
    explore.textContent=loading?'Annuler l’ouverture':orbiting?'Revenir aux vues':'Explorer en 3D';
    host.hidden=!orbiting;
    byId('relief-help').hidden=!orbiting;
    [other,byId('relief-divider'),range,byId('relief-left'),byId('relief-right')].forEach(el=>el.hidden=!paired);
    if (paired) {
      chooseImage(other,reference);
      other.alt='Vue de comparaison, '+labels.get(reference)+'. '+notes.find(el=>el.dataset.periodNote===reference).querySelector('p').textContent;
      byId('relief-left').textContent=labels.get(period); byId('relief-right').textContent=labels.get(reference);
      range.setAttribute('aria-label','Répartir la vue entre '+labels.get(period)+' à gauche et '+labels.get(reference)+' à droite');
      setSplit();
    }
  }
  function cancelViewer(nextMode) {
    controller?.abort(); controller=null; viewer=null; mode=nextMode;
    status.textContent=''; update();
  }
  function fallback() {
    const restoreFocus=host.contains(document.activeElement);
    cancelViewer('plate');
    status.textContent='La vue en 3D est indisponible. Les vues fixes et la comparaison restent accessibles.';
    if (restoreFocus) explore.focus({preventScroll:true});
  }
  async function refreshModel() {
    const token=controller, requested=period;
    try { if (viewer) await viewer.show(requested); }
    catch { if (token && token===controller && requested===period) fallback(); }
  }
  async function openViewer() {
    const token=new AbortController();
    controller=token; mode='loading'; status.textContent='Ouverture de la maquette…'; update();
    try {
      const module=await import('./relief-viewer.min.js');
      if (token.signal.aborted) return;
      const loaded=await module.createViewer(host,token.signal,()=>{if(token===controller) fallback();});
      if (token!==controller) return;
      viewer=loaded;
      viewer.frame(frame==='ville');
      // Keep the still in place until the current texture is ready, including when
      // another date is selected while opening the model.
      let openingPeriod;
      do {
        openingPeriod=period;
        try { await viewer.show(openingPeriod); }
        catch (error) { if (openingPeriod===period) throw error; }
        if (token!==controller) return;
      } while (period!==openingPeriod);
      mode='orbit'; status.textContent=''; update(); viewer.frame(frame==='ville');
      if (document.activeElement===explore) viewer.focus();
    } catch { if (token===controller) fallback(); }
  }
  buttons.forEach(b=>b.addEventListener('click',()=>{
    markManual(atlas); period=b.dataset.period; update();
    if(mode==='orbit') refreshModel();
  }));
  camera.addEventListener('click',()=>{
    markManual(atlas); frame=frame==='ville'?'golfe':'ville'; update(); viewer?.frame(frame==='ville');
  });
  compare.addEventListener('click',()=>{
    markManual(atlas);
    const next=mode==='compare'?'plate':'compare';
    range.value=50; cancelViewer(next);
    if(next==='compare') range.focus({preventScroll:true});
  });
  range.addEventListener('input',()=>{markManual(atlas);setSplit();});
  range.addEventListener('keydown',e=>{
    if(e.key==='Escape') {cancelViewer('plate');compare.focus({preventScroll:true});}
  });
  explore.addEventListener('click',()=>{
    markManual(atlas);
    if(mode==='loading'||mode==='orbit') cancelViewer('plate');
    else openViewer();
  });
  host.addEventListener('keydown',e=>{
    if(e.key==='Escape') {cancelViewer('plate');explore.focus({preventScroll:true});}
  });
  byId('relief-prints').hidden=true;
  camera.hidden=false;
  atlas.querySelector('.relief-periods').hidden=false;
  atlas.querySelector('.relief-actions').hidden=false;

  // Chapter-relative pauses in the published recording. Only used while the listener has Suivre enabled.
  const cues={
    citadelle:[[25,'rocher',0]],
    sel:[[14,'relief','terrier'],[30,'reflet-du-sel',0]],
    liege:[[19,'cour-saint-joseph',0]],
    montagne:[[20,'regard-ospedale',0]],
    maison:[[36,'des-toits-a-la-rue',0],[55,'dans-la-rue',0]]
  };
  let lastChapter='', lastCue='';
  document.addEventListener('lettre:suivre',event=>{
    const {chapter,elapsed}=event.detail;
    if(chapter!==lastChapter) {
      if(lastChapter===manualChapter) manualChapter='';
      lastChapter=chapter;lastCue='';
    }
    const list=cues[chapter] || [];
    const cue=list.filter(([start])=>elapsed>=start).pop();
    if(!cue) {lastCue='';return;}
    if(chapter===manualChapter||lastCue===cue) return;
    lastCue=cue;
    const [,id,view]=cue;
    if(id==='relief') {
      period=view; frame='golfe'; cancelViewer('plate');
    } else leaves.get(id)?.(view);
    byId(id).scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});
  });
})();
