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
  const shore=byId('relief-shore');
  const range=byId('relief-range'), host=byId('relief-canvas'), status=byId('relief-status');
  const buttons=[...atlas.querySelectorAll('[data-period]')];
  const periodNotes=new Map([...atlas.querySelectorAll('[data-period-note]')].map(el=>[el.dataset.periodNote,el]));
  const shoreNotes=new Map([...atlas.querySelectorAll('[data-shore-note]')].map(el=>[el.dataset.shoreNote,el]));
  const shorePairs={'1951':'1975','1975':'2024','2024':'1951'};
  const periods=buttons.map(b=>b.dataset.period);
  const labels=new Map(buttons.map(b=>[b.dataset.period,b.textContent]));
  const markers={
    golfe:[[40.526,41.43],[44.507,70.508]],
    ville:[[46.273,27.865],[69.41,71.528]],
    port:[[27.411,31.245],[43.778,49.801]]
  };
  let period='terrier', frame='golfe', comparisonFrame='golfe', shoreView=false, mode='plate', controller, viewer;
  function currentFrame() {
    return shoreView ? 'port' : mode==='compare' ? comparisonFrame : frame;
  }
  function setMarker(el,coord,label) {
    el.style.left=coord[0]+'%'; el.style.top=coord[1]+'%'; el.textContent=label;
  }
  function setSplit() {
    stage.style.setProperty('--split',range.value+'%');
    range.setAttribute('aria-valuetext',range.value+' % pour '+byId('relief-left').textContent);
  }
  function chooseImage(image, era, view) {
    const src='assets/relief/'+view+'-'+era+'.webp';
    if(image.getAttribute('src')!==src) image.src=src;
    const note=(view==='port' ? shoreNotes : periodNotes).get(era);
    const places={golfe:'Vue du golfe',ville:'Détail de la vieille ville',port:'Le port en relief, vu depuis la mer'};
    image.alt=places[view]+'. '+labels.get(era)+'. '+note.querySelector('p').textContent;
  }
  function update() {
    const paired=mode==='compare', orbiting=mode==='orbit', loading=mode==='loading';
    const view=currentFrame();
    const town=view==='ville', reference=shoreView ? shorePairs[period] : period==='2024'?'1975':'2024';
    // The modern model follows the 2024 photograph in the chronological period controls.
    const [left,right]=periods.filter(era=>era===period || era===reference);
    stage.dataset.mode=mode;
    stage.dataset.view=view;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===period)));
    periodNotes.forEach((el,era)=>el.hidden=shoreView || era!==period);
    shoreNotes.forEach((el,era)=>el.hidden=!shoreView || era!==period);
    chooseImage(plate,paired ? left : period,view);
    setMarker(byId('relief-hill'),markers[view][0],'La vieille ville');
    setMarker(byId('relief-water'),markers[view][1],town||shoreView?(period==='terrier'||period==='1951'?'L’anse':'Le port'):(period==='terrier'?'Le marais':'Les salines'));
    shore.setAttribute('aria-pressed',String(shoreView));
    shore.textContent=shoreView?'Revenir aux photographies':'Voir le port en relief';
    camera.hidden=shoreView;
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
      chooseImage(other,right,view);
      byId('relief-left').textContent=labels.get(left); byId('relief-right').textContent=labels.get(right);
      range.setAttribute('aria-label','Répartir la vue entre '+labels.get(left)+' à gauche et '+labels.get(right)+' à droite');
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
    const token=controller, requested=period, requestedShore=shoreView;
    try { if (viewer) await viewer.show(requested,requestedShore); }
    catch { if (token && token===controller && requested===period && requestedShore===shoreView) fallback(); }
  }
  async function openViewer() {
    const token=new AbortController();
    controller=token; mode='loading'; status.textContent='Ouverture de la maquette…'; update();
    try {
      const module=await import('./relief-viewer.min.js?v=rivages-1');
      if (token.signal.aborted) return;
      const loaded=await module.createViewer(host,token.signal,()=>{if(token===controller) fallback();});
      if (token!==controller) return;
      viewer=loaded;
      viewer.frame(currentFrame());
      // Keep the still in place until the current texture is ready, including when
      // another date is selected while opening the model.
      let openingPeriod, openingShore;
      do {
        openingPeriod=period;
        openingShore=shoreView;
        try { await viewer.show(openingPeriod,openingShore); }
        catch (error) { if (openingPeriod===period && openingShore===shoreView) throw error; }
        if (token!==controller) return;
      } while (period!==openingPeriod || shoreView!==openingShore);
      mode='orbit'; status.textContent=''; update(); viewer.frame(currentFrame());
      if (document.activeElement===explore) viewer.focus();
    } catch { if (token===controller) fallback(); }
  }
  buttons.forEach(b=>b.addEventListener('click',()=>{
    markManual(atlas); period=b.dataset.period;
    if(shoreView && !shoreNotes.has(period)) {
      shoreView=false;
      viewer?.frame(currentFrame());
    }
    update();
    if(mode==='orbit') refreshModel();
  }));
  shore.addEventListener('click',()=>{
    markManual(atlas);
    shoreView=!shoreView;
    if(shoreView && !shoreNotes.has(period)) period=period==='bati'?'2024':'1951';
    update();
    viewer?.frame(currentFrame());
    if(mode==='orbit') refreshModel();
  });
  camera.addEventListener('click',()=>{
    markManual(atlas);
    if(mode==='compare') comparisonFrame=comparisonFrame==='ville'?'golfe':'ville';
    else frame=frame==='ville'?'golfe':'ville';
    update(); viewer?.frame(currentFrame());
  });
  compare.addEventListener('click',()=>{
    markManual(atlas);
    const next=mode==='compare'?'plate':'compare';
    if(next==='compare') comparisonFrame=window.matchMedia('(max-width: 760px)').matches ? 'ville' : frame;
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
  atlas.querySelector('.relief-periods').hidden=false;
  atlas.querySelector('.relief-actions').hidden=false;
  function openWaterfrontLink() {
    if(location.hash==='#port-en-relief') {
      period='1951'; shoreView=true; cancelViewer('plate');
    }
  }
  update();
  openWaterfrontLink();
  window.addEventListener('hashchange',openWaterfrontLink);

  // Chapter-relative pauses in the published recording. Only used while the listener has Suivre enabled.
  const cues={
    citadelle:[[25,'rocher',0]],
    sel:[[5,'plan-des-salines',0],[18,'relief','terrier'],[30,'reflet-du-sel',0]],
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
      period=view; frame='golfe'; shoreView=false; cancelViewer('plate');
    } else leaves.get(id)?.(view);
    byId(id).scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});
  });
})();
