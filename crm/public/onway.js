/* One-time "Andrew is on his way" celebration (owner surprise, 2026-10-10).
   HAOnWay.maybeShow({ get, post, who }) -- get()/post(body) hit private_cal.
   Shown once per person: seen flag in app.cal_prefs.prefs.seen.onway
   (server) + localStorage. Marked seen only when closed. Expires 2026-10-13 00:00 Manila. */
(function(){
  var KEY='onway', LS='ha_seen_onway', END=Date.parse('2026-10-12T16:00:00Z');
  function lsGet(){ try{ return localStorage.getItem(LS); }catch(e){ return null; } }
  function lsSet(){ try{ localStorage.setItem(LS,'1'); }catch(e){} }
  var CSS=''+
  '#owOv{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;overflow:hidden;'+
  'background:radial-gradient(circle at 50% 40%,#ffe3f1 0%,#ffc2dd 35%,#a77bff 100%);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;opacity:0;transition:opacity .45s ease}'+
  '#owOv.on{opacity:1}#owOv.off{opacity:0}'+
  '#owOv canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}'+
  '#owOv .ow-x{position:absolute;top:14px;right:14px;width:48px;height:48px;border-radius:50%;border:0;background:rgba(255,255,255,.9);color:#7a1d55;font-size:26px;line-height:48px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18);z-index:3}'+
  '#owOv .ow-x:focus-visible{outline:3px solid #fff;outline-offset:3px}'+
  '#owOv .ow-box{position:relative;z-index:2;text-align:center;padding:0 16px;max-width:900px}'+
  '#owOv h1{margin:0;font-size:clamp(38px,9vw,92px);line-height:1.05;font-weight:900;color:#fff;letter-spacing:-.01em;'+
  'text-shadow:0 3px 0 #d6337f,0 8px 24px rgba(120,20,80,.35);animation:owPop .9s cubic-bezier(.2,1.6,.4,1) both .2s}'+
  '#owOv p{margin:18px 0 0;font-size:clamp(16px,3.6vw,22px);font-weight:700;color:#5b1640;background:rgba(255,255,255,.75);display:inline-block;padding:8px 16px;border-radius:999px;animation:owPop .8s ease both .7s}'+
  '#owOv .ow-sky{position:relative;width:min(92vw,720px);height:150px;margin:0 auto 10px}'+
  '#owOv .ow-sky svg{width:100%;height:100%;overflow:visible}'+
  '#owOv .ow-lbl{font-size:13px;font-weight:800;fill:#5b1640}'+
  '#owOv .ow-heart{font-size:40px;animation:owBeat 1s ease-in-out infinite}'+
  '#owOv .ow-ball{position:absolute;bottom:-140px;width:56px;height:70px;border-radius:50% 50% 48% 48%;z-index:1;animation:owRise linear infinite}'+
  '#owOv .ow-ball:after{content:"";position:absolute;left:50%;top:100%;width:1px;height:60px;background:rgba(0,0,0,.25)}'+
  '@keyframes owPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}'+
  '@keyframes owBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}'+
  '@keyframes owRise{from{transform:translateY(0)}to{transform:translateY(-130vh)}}'+
  '@media (prefers-reduced-motion:reduce){#owOv *{animation:none !important}#owOv .ow-ball{display:none}}';

  function build(onClose){
    var st=document.createElement('style'); st.id='owCss'; st.textContent=CSS; document.head.appendChild(st);
    var ov=document.createElement('div'); ov.id='owOv';
    ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','Andrew is on his way!!!!');
    var path='M30,120 C200,-20 480,-20 650,95';
    ov.innerHTML='<canvas></canvas>'+
      '<button type="button" class="ow-x" aria-label="Close">&times;</button>'+
      '<div class="ow-box">'+
        '<div class="ow-sky"><svg viewBox="0 0 720 150" aria-hidden="true">'+
          '<path id="owPath" d="'+path+'" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>'+
          '<text class="ow-lbl" x="6" y="146">Bangkok</text><text class="ow-lbl" x="640" y="146">Manila</text>'+
          '<foreignObject x="628" y="72" width="60" height="60"><div class="ow-heart" xmlns="http://www.w3.org/1999/xhtml">❤️</div></foreignObject>'+
          '<g id="owPlane"><g transform="rotate(0) translate(-22,-22)"><text x="0" y="34" font-size="40">✈️</text></g></g>'+
        '</svg></div>'+
        '<h1>Andrew is on his way!!!!</h1>'+
        '<p>Landing in Manila Mon, Oct 12 · 6:00 AM</p>'+
      '</div>';
    document.body.appendChild(ov);
    var reduce=false; try{ reduce=matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
    if(!reduce){ var cols=['#ff4d8d','#ffb703','#8ecae6','#b388ff','#06d6a0','#ff7aa2'];
      for(var i=0;i<10;i++){ var b=document.createElement('div'); b.className='ow-ball';
        b.style.left=(5+i*9.5)+'%'; b.style.background=cols[i%cols.length];
        b.style.animationDuration=(9+Math.random()*6)+'s'; b.style.animationDelay=(-Math.random()*10)+'s'; ov.appendChild(b); } }
    var p=ov.querySelector('#owPath'), pl=ov.querySelector('#owPlane'), L=p.getTotalLength(), raf=0, t0=0;
    function place(f){ var a=p.getPointAtLength(L*f), b2=p.getPointAtLength(Math.min(L,L*f+1)), ang=Math.atan2(b2.y-a.y,b2.x-a.x)*180/Math.PI;
      pl.setAttribute('transform','translate('+a.x+','+a.y+') rotate('+(ang+45)+')'); }
    var cv=ov.querySelector('canvas'), cx=cv.getContext('2d'), parts=[], W=0, H=0, dpr=Math.min(2,window.devicePixelRatio||1);
    function size(){ W=ov.clientWidth; H=ov.clientHeight; cv.width=W*dpr; cv.height=H*dpr; cx.setTransform(dpr,0,0,dpr,0,0); }
    size(); window.addEventListener('resize',size);
    var CC=['#ff4d8d','#ffd166','#06d6a0','#4cc9f0','#b388ff','#fff'];
    function burst(x,y,n){ for(var i=0;i<n;i++){ var a=Math.random()*Math.PI*2, s=4+Math.random()*9;
      parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-6,r:4+Math.random()*5,c:CC[i%CC.length],rot:Math.random()*6,vr:Math.random()*.3-.15,life:0}); } }
    function rain(){ parts.push({x:Math.random()*W,y:-10,vx:Math.random()*2-1,vy:2+Math.random()*2,r:4+Math.random()*4,c:CC[(Math.random()*CC.length)|0],rot:0,vr:.1,life:0}); }
    function frame(ts){
      if(!t0) t0=ts; var e=(ts-t0)/1000;
      place(Math.min(1,(e%6)/4.5));
      cx.clearRect(0,0,W,H);
      if(parts.length<260 && Math.random()<.6) rain();
      for(var i=parts.length-1;i>=0;i--){ var q=parts[i]; q.vy+=.15; q.vx*=.99; q.x+=q.vx; q.y+=q.vy; q.rot+=q.vr; q.life++;
        if(q.y>H+20){ parts.splice(i,1); continue; }
        cx.save(); cx.translate(q.x,q.y); cx.rotate(q.rot); cx.fillStyle=q.c; cx.fillRect(-q.r/2,-q.r/4,q.r,q.r/2); cx.restore(); }
      raf=requestAnimationFrame(frame); }
    if(reduce){ place(1); for(var k=0;k<90;k++){ cx.fillStyle=CC[k%CC.length]; cx.fillRect(Math.random()*W,Math.random()*H,8,4); } }
    else { setTimeout(function(){ burst(W*.2,H*.75,90); burst(W*.8,H*.75,90); },300); setTimeout(function(){ burst(W*.5,H*.3,120); },1800); raf=requestAnimationFrame(frame); }
    requestAnimationFrame(function(){ ov.classList.add('on'); });
    var btn=ov.querySelector('.ow-x'); setTimeout(function(){ try{ btn.focus(); }catch(e){} },50);
    function close(){ document.removeEventListener('keydown',onKey); ov.classList.remove('on'); ov.classList.add('off');
      setTimeout(function(){ cancelAnimationFrame(raf); window.removeEventListener('resize',size); ov.remove(); st.remove(); },480);
      if(onClose) onClose(); }
    function onKey(ev){ if(ev.key==='Escape') close(); }
    btn.onclick=close; document.addEventListener('keydown',onKey);
  }

  window.HAOnWay={
    preview:function(){ build(null); },
    maybeShow:function(o){ return;
      try{
        if(Date.now()>=END || lsGet() || document.getElementById('owOv')) return;
        Promise.resolve(o.get()).then(function(r){
          var seen=r && r.prefs && r.prefs.seen && r.prefs.seen[KEY];
          if(!r || r.who!==o.who || seen){ if(seen) lsSet(); return; }
          setTimeout(function(){ if(!lsGet() && Date.now()<END) build(function(){ lsSet(); try{ Promise.resolve(o.post({op:'mark_seen',key:KEY})).catch(function(){}); }catch(e){} }); },900);
        }).catch(function(){});
      }catch(e){}
    }
  };
})();
