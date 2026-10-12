/* ======================================================================
   MARANATHA ONBOARDING CHAPTER  -  design prototype

   The next chapter of the opening. It begins on the opening's last frame
   (portrait + gold wordmark) and ends on the first question.

     1  the word turns back into the fish   (the same gold that made it)
     2  the fish leaves, carrying the wind
     3  a school of the same fish comes out of the paper
     4  the fish joins them, and the gold passes through the school
     5  the school settles into a slim band; the first question rises

   Reused unchanged from the approved opening: the fish outline, the
   metallic gold gradients, the tapered ribbons, the motes that ride the
   ribbons, the specular band, the wordmark and its sheen.

   Everything is a pure function of t, so scrubbing equals playing.

   The stage is the reference phone, 390 x 844 px. The opening is drawn
   in its own 320 x 660 space; it is placed here with the same scale and
   offset the app would give it (cover), so frame 0 is the opening's last
   frame exactly.
   ====================================================================== */
(function(global){
  "use strict";

  var PHONE = { w:390, h:844 };
  var K  = Math.max(390/320, 844/660);          /* 1.27879 */
  var OX = (390 - 320*K)/2;                       /* -9.6   */
  var LOGO = { x:160, y:282, r:58 };              /* opening space */
  var WORD = { x:160, y:396, size:16, track:3.0 };
  var WORD_TEXT = "MARANATHA";
  var MID_Y_OPEN = WORD.y - WORD.size*0.34;       /* the word's centre line */

  /* where the word's centre was, in px: the fish re-forms here */
  var F0 = { x:160*K + OX, y:MID_Y_OPEN*K };
  var HERO = 0.58*K;                              /* the fish's size in the opening */

  /* THE FISH. Same outline as the approved opening, nose toward +x. */
  var FISH_A = [ 40,0,  22,-18,  -2,-18, -22,0, -30, 8, -36, 12, -40, 15];
  var FISH_B = [ 40,0,  22, 18,  -2, 18, -22,0, -30,-8, -36,-12, -40,-15];
  function toPath(n){
    return "M "+n[0]+" "+n[1]+
           " C "+n[2]+" "+n[3]+" "+n[4]+" "+n[5]+" "+n[6]+" "+n[7]+
           " C "+n[8]+" "+n[9]+" "+n[10]+" "+n[11]+" "+n[12]+" "+n[13];
  }
  var FISH_A_D = toPath(FISH_A), FISH_B_D = toPath(FISH_B);
  var STROKE_L = 3.2/0.58;                        /* stroke width, local units */

  /* ------------------------------------------------------------------
     TIMELINE, wall-clock seconds
     ------------------------------------------------------------------ */
  var T = {
    hold    : [0.00, 0.30],   /* the opening's last frame, the gold wakes   */
    release : [0.25, 1.55],   /* letters give their gold back, outer first   */
    formed  : [1.35, 1.70],   /* the fish is whole, and rests a moment       */
    swim    : [1.65, 3.55],   /* the journey                                 */
    logoOut : [1.60, 2.70],   /* the mark recedes                            */
    resolve : [1.95, 3.35],   /* the school comes out of the paper           */
    join    : [3.05, 4.30],   /* the fish slows into its place               */
    gold    : [3.45, 4.60],   /* the gold passes through the school          */
    form    : [3.55, 4.55],   /* the first question rises; tappable by ~4.0  */
    settle  : [4.30, 5.00],
    total   : 5.00
  };

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function ss(t){ t=clamp(t,0,1); return t*t*(3-2*t); }
  function span(t,a,b){ return clamp((t-a)/(b-a),0,1); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var x = Math.imul(a ^ a >>> 15, 1 | a);
      x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x;
      return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
  }
  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs){
    var e = document.createElementNS(NS, tag), k;
    for(k in attrs){ if(Object.prototype.hasOwnProperty.call(attrs,k)) e.setAttribute(k, attrs[k]); }
    return e;
  }
  function setA(el, name, val){
    var c = el.__c || (el.__c = {});
    if(c[name] !== val){ c[name] = val; el.setAttribute(name, val); }
  }
  var SEQ = 0;

  /* ------------------------------------------------------------------
     THE JOURNEY PATH.
     Built from a HEADING PROFILE, not from a drawn curve: the heading
     changes steadily from one value to another and never turns back, so
     the fish cannot wobble, snap or double back. That is the property
     that was missing in the opening's early versions.

     It leaves heading left, sweeps clockwise round the logo, and levels
     out heading right at the top: the same sense of rotation as the
     opening's orbit.
     ------------------------------------------------------------------ */
  var PATH = { n:700, L:420, H0:-165, H1:-35, a:1.15 };
  var PX = new Float64Array(PATH.n), PY = new Float64Array(PATH.n), PA = new Float64Array(PATH.n);
  var J = { x:0, y:0 };
  function theta(u){
    var a = PATH.a;
    var g = u<=0 ? 0 : (u>=1 ? 1 : Math.pow(u,a)/(Math.pow(u,a)+Math.pow(1-u,a)));
    return PATH.H0 + (PATH.H1-PATH.H0)*g;
  }
  (function buildPath(){
    var n = PATH.n, ds = PATH.L/(n-1), i;
    PX[0] = F0.x; PY[0] = F0.y; PA[0] = theta(0);
    for(i=1;i<n;i++){
      var th = theta((i-0.5)/(n-1))*Math.PI/180;
      PX[i] = PX[i-1] + Math.cos(th)*ds;
      PY[i] = PY[i-1] + Math.sin(th)*ds;
      PA[i] = theta(i/(n-1));
    }
    J.x = PX[n-1]; J.y = PY[n-1];
  })();
  function atP(p, out){
    var n = PATH.n, f = clamp(p,0,1)*(n-1), i = f|0, r = f-i;
    if(i>=n-1){ out.x=PX[n-1]; out.y=PY[n-1]; out.a=PA[n-1]; return out; }
    out.x = PX[i]+(PX[i+1]-PX[i])*r; out.y = PY[i]+(PY[i+1]-PY[i])*r; out.a = PA[i]+(PA[i+1]-PA[i])*r;
    return out;
  }
  var _q = {x:0,y:0,a:0}, _r = {x:0,y:0,a:0};

  /* speed along the journey: monotone cubic, from rest to rest.
     Both end tangents are ZERO (the fish starts and arrives at rest), and
     every interior keyframe has a positive slope, so it never stops in
     the middle. */
  var KU = [0, 0.14, 0.34, 0.58, 0.80, 1.00];
  var KP = [0, 0.07, 0.30, 0.66, 0.93, 1.00];
  var KM = (function(){
    var n=KU.length, d=[], m=[], i;
    for(i=0;i<n-1;i++) d.push((KP[i+1]-KP[i])/(KU[i+1]-KU[i]));
    m.push(0);
    for(i=1;i<n-1;i++) m.push((d[i-1]+d[i])/2);
    m.push(0);
    for(i=0;i<n-1;i++){
      if(d[i]===0){ m[i]=0; m[i+1]=0; continue; }
      var a=m[i]/d[i], b=m[i+1]/d[i], s=a*a+b*b;
      if(s>9){ var tau=3/Math.sqrt(s); m[i]=tau*a*d[i]; m[i+1]=tau*b*d[i]; }
    }
    return m;
  })();
  function progress(u){
    u = clamp(u,0,1);
    var i=0, n=KU.length;
    while(i<n-2 && u>KU[i+1]) i++;
    var h=KU[i+1]-KU[i], s=(u-KU[i])/h, s2=s*s, s3=s2*s;
    return (2*s3-3*s2+1)*KP[i] + (s3-2*s2+s)*h*KM[i] +
           (-2*s3+3*s2)*KP[i+1] + (s3-s2)*h*KM[i+1];
  }
  function fishAt(t){ return progress(span(t, T.swim[0], T.swim[1])); }

  /* the fish shrinks as it recedes toward the school: depth, not a cut */
  var MID_S = 0.48, MID_OP = 0.80;
  function fishScale(t){ return lerp(HERO, MID_S, ss(span(t, 2.00, 3.55))); }

  /* ------------------------------------------------------------------
     THE SCHOOL. Offsets from the landing point J, so the fish that
     arrives is simply one more member. Three depths: front, middle,
     back. All face the way the form progresses (right), a little up.
     ------------------------------------------------------------------ */
  var LAYER = {
    front: { s:0.62, op:1.00 },
    mid  : { s:MID_S, op:MID_OP },
    back : { s:0.34, op:0.46 }
  };
  var SCHOOL_DEF = [
    /* dx,  dy, layer,  heading */
    [   0,   0, "mid",   -8, true ],      /* the fish that just arrived: the tail */
    /* near row (front): larger, darker, lower on the screen */
    [  36,  30, "front", -6 ],
    [ 101,  17, "front", -11 ],
    [ 163,  27, "front", -5 ],
    [ 216,   6, "front", -9 ],
    /* middle */
    [  74, -11, "mid",   -8 ],
    [ 128, -31, "mid",   -4 ],
    [ 188, -21, "mid",   -10 ],
    [ 226, -42, "mid",   -6 ],
    /* far row (back): small and pale */
    [ -28, -34, "back",  -6 ],
    [  30, -47, "back",  -9 ],
    [  92, -60, "back",  -5 ],
    [ 154, -66, "back",  -8 ],
    [ 206, -62, "back",  -4 ]
  ];
  var N_SCHOOL = SCHOOL_DEF.length;

  /* band geometry in px: where the school lives on the settled screen */
  var BAND = { y0:96, h:150 };

  /* ------------------------------------------------------------------ */
  var N_WIND = 96, N_FISH = 120, N_HAZE = 14, N_RIBBON = 5, N_BLOOM = 14;
  var TIERS = 8, RIB_PTS = 26, SRIB_PTS = 11;
  var EMIT = [T.swim[0], T.join[0]+0.35];

  var FISH_PTS = [];
  function buildTable(){
    if(FISH_PTS.length) return;
    var holder = svgEl("svg",{width:"0",height:"0"});
    holder.setAttribute("style","position:absolute;width:0;height:0;overflow:hidden");
    var fa = svgEl("path",{d:FISH_A_D}), fb = svgEl("path",{d:FISH_B_D});
    holder.appendChild(fa); holder.appendChild(fb);
    document.body.appendChild(holder);
    try{
      [fa,fb].forEach(function(el){
        var L=el.getTotalLength(), k, m=N_FISH/2;
        for(k=0;k<m;k++){ var q=el.getPointAtLength(L*(k+0.5)/m); FISH_PTS.push([q.x,q.y]); }
      });
    }catch(e){ for(var z=0;z<N_FISH;z++) FISH_PTS.push([0,0]); }
    document.body.removeChild(holder);
  }

  var WIND = [], FISHP = [], HAZE = [], RIBBON = [], SCHOOL = [];
  function buildParticles(){
    var rnd = mulberry32(20261011), i;
    WIND.length = 0; FISHP.length = 0; HAZE.length = 0; RIBBON.length = 0; SCHOOL.length = 0;

    for(i=0;i<N_WIND;i++){
      var f = (i + rnd()*0.8) / N_WIND;
      WIND.push({
        b: lerp(EMIT[0], EMIT[1], f),
        rib: i % N_RIBBON, jit:(rnd()-0.5)*3.4, rise:-4 - rnd()*10,
        life: 0.54 + rnd()*0.46, amp: 1.2 + rnd()*3.4, fr: 2.0 + rnd()*3.2,
        ph: rnd()*6.28, r: 0.26 + rnd()*0.66, tb: rnd(),
        gf: 2.4 + rnd()*3.6, gp: rnd()*6.28, px:0, py:0, op:0, sh:0
      });
    }
    for(i=0;i<N_RIBBON;i++){
      RIBBON.push({
        lag: 5 + i*6 + rnd()*6, len: 104 + rnd()*82,
        lat: (i%2?1:-1)*(3.4 + i*2.4 + rnd()*4.0),
        w: 0.38 + rnd()*0.62, fr: 1.4 + rnd()*1.6, ph: rnd()*6.28,
        op: 0.34 + rnd()*0.28
      });
    }
    for(i=0;i<N_HAZE;i++){
      HAZE.push({ lag: 0.006 + (i/N_HAZE)*0.075, r: 4 + rnd()*7.5,
        op: 0.038 + rnd()*0.040, amp: 2 + rnd()*5, fr: 1.4 + rnd()*2.0, ph: rnd()*6.28 });
    }

    /* The word's letters give their gold back to the fish.
       Each point on the fish outline is fed by the letter that sits at
       the same screen position, so the streams run side by side and
       never cross: the left of the word becomes the left of the fish. */
    var rot = PA[0]*Math.PI/180, ca = Math.cos(rot), sa = Math.sin(rot);
    var tgt = [];
    for(i=0;i<N_FISH;i++){
      var p = FISH_PTS[i] || [0,0];
      tgt.push({ i:i, sx: F0.x + (p[0]*ca - p[1]*sa)*HERO, sy: F0.y + (p[0]*sa + p[1]*ca)*HERO });
    }
    tgt.sort(function(a,b){ return a.sx - b.sx; });
    var per = N_FISH/9;
    var letterOf = new Array(N_FISH);
    for(i=0;i<N_FISH;i++) letterOf[tgt[i].i] = Math.min(8, (i/per)|0);
    for(i=0;i<N_FISH;i++){
      FISHP.push({
        src: FISH_PTS[i] || [0,0], li: letterOf[i],
        delay: rnd()*0.10, tb: rnd(), curl: -(16 + rnd()*22),
        r: 0.34 + rnd()*0.74, jx:(rnd()-0.5)*7, jy:(rnd()-0.5)*5.5
      });
    }

    for(i=0;i<N_SCHOOL;i++){
      var d = SCHOOL_DEF[i], L = LAYER[d[2]];
      SCHOOL.push({
        bx: J.x + d[0], by: J.y + d[1], s: L.s, op: L.op, a0: d[3], user: !!d[4],
        ax: 2.2 + rnd()*2.4, ay: 1.6 + rnd()*2.0, wx: 0.45 + rnd()*0.5, wy: 0.5 + rnd()*0.5,
        px: rnd()*6.28, py: rnd()*6.28, ah: 1.4 + rnd()*1.8, wh: 0.4 + rnd()*0.4, ph: rnd()*6.28,
        rib: [ {len:40 + rnd()*28, lat:1.2 + rnd()*1.6, w:0.30 + rnd()*0.30, fr:1.2 + rnd()*1.4, ph:rnd()*6.28, op:0.10 + rnd()*0.07},
               {len:30 + rnd()*24, lat:-(1.0 + rnd()*1.4), w:0.24 + rnd()*0.26, fr:1.0 + rnd()*1.4, ph:rnd()*6.28, op:0.08 + rnd()*0.06} ],
        delay: i*0.012
      });
    }
  }

  /* ------------------------------------------------------------------ */
  function buildScene(host, opts){
    opts = opts || {};
    var band = !!opts.band;
    var vb = band ? ("0 "+BAND.y0+" "+PHONE.w+" "+BAND.h) : ("0 0 "+PHONE.w+" "+PHONE.h);
    var svg = svgEl("svg",{ viewBox:vb,
      preserveAspectRatio: band ? "xMidYMid slice" : "xMidYMid slice" });
    var uid = "ob" + (SEQ++);

    var defs = svgEl("defs",{});
    function grad(id, type, attrs, stops){
      var g = svgEl(type, Object.assign({id:id}, attrs));
      stops.forEach(function(s){
        g.appendChild(svgEl("stop",{offset:s[0],"stop-color":s[1],"stop-opacity":s[2]}));
      });
      defs.appendChild(g);
      return "url(#"+id+")";
    }
    var HAZEF = grad(uid+"h","radialGradient",{cx:"0.5",cy:"0.5",r:"0.5"},[
      ["0","var(--gold-high)","0.55"],["0.45","var(--gold-base)","0.24"],["1","var(--gold-base)","0"]]);
    var RIBF = grad(uid+"r","linearGradient",{x1:"0",y1:"0",x2:"0.7",y2:"1"},[
      ["0","var(--gold-rim)","1"],["0.30","var(--gold-base)","1"],["0.55","var(--dust4)","1"],
      ["0.80","var(--gold-base)","1"],["1","var(--gold-rim)","1"]]);
    var RIBL = grad(uid+"l","linearGradient",{x1:"0",y1:"0",x2:"0.7",y2:"1"},[
      ["0","var(--gold-base)","1"],["0.5","var(--dust4)","1"],["1","var(--gold-base)","1"]]);
    var RIMF = grad(uid+"m","linearGradient",{x1:"0",y1:"0",x2:"1",y2:"1"},[
      ["0","var(--gold-high)","1"],["0.5","var(--dust4)","1"],["1","var(--gold-base)","1"]]);
    var TEXTF = "url(#"+uid+"t)";
    var textGrad = svgEl("linearGradient",{ id:uid+"t", gradientUnits:"userSpaceOnUse",
      x1:"84", y1:"384", x2:"236", y2:"402" });
    [["0","var(--gold-deep)"],["0.28","var(--gold-base)"],["0.46","var(--gold-textpeak)"],
     ["0.52","var(--gold-textpeak)"],["0.58","var(--gold-textpeak)"],["0.76","var(--gold-base)"],
     ["1","var(--gold-deep)"]].forEach(function(s){
      textGrad.appendChild(svgEl("stop",{offset:s[0],"stop-color":s[1]}));
    });
    defs.appendChild(textGrad);
    var fishGrad = svgEl("linearGradient",{ id:uid+"f", gradientUnits:"objectBoundingBox",
      x1:"0", y1:"0", x2:"0.85", y2:"1" });
    [["0","var(--scene-ink)"],["0.34","var(--ink-soft)"],["0.52","var(--ink-soft)"],
     ["0.70","var(--scene-ink)"],["1","var(--scene-ink)"]].forEach(function(st){
      fishGrad.appendChild(svgEl("stop",{offset:st[0],"stop-color":st[1]}));
    });
    defs.appendChild(fishGrad);
    var FISHF = "url(#"+uid+"f)";
    svg.appendChild(defs);

    svg.appendChild(svgEl("rect",{x:0,y:0,width:PHONE.w,height:PHONE.h,fill:"var(--scene-ground)"}));

    /* ---- the opening's last frame: portrait + wordmark ---- */
    var openG = svgEl("g",{ transform:"translate("+OX+" 0) scale("+K+")" });
    var logoG = svgEl("g",{});
    var slot = svgEl("g",{});
    slot.appendChild(svgEl("circle",{cx:LOGO.x,cy:LOGO.y,r:LOGO.r,fill:"var(--scene-ink)","fill-opacity":".05"}));
    slot.appendChild(svgEl("circle",{cx:LOGO.x,cy:LOGO.y,r:LOGO.r,fill:"none",stroke:"var(--scene-ink)",
      "stroke-width":"1.1","stroke-opacity":".45","stroke-dasharray":"4 4"}));
    logoG.appendChild(slot);
    var logoImg = svgEl("image",{ x:(LOGO.x-LOGO.r), y:(LOGO.y-LOGO.r), width:(LOGO.r*2), height:(LOGO.r*2),
      preserveAspectRatio:"xMidYMid meet", visibility:"hidden" });
    logoG.appendChild(logoImg);
    openG.appendChild(logoG);
    var probe = svgEl("text",{x:"0",y:"0","text-anchor":"start",
      "font-family":"'Noto Serif', Georgia, serif","font-weight":"600",
      "font-size":String(WORD.size),"letter-spacing":String(WORD.track),visibility:"hidden"});
    probe.textContent = WORD_TEXT;
    openG.appendChild(probe);
    var letters=[], i;
    for(i=0;i<WORD_TEXT.length;i++){
      var lt = svgEl("text",{x:"0",y:String(WORD.y),"text-anchor":"middle",
        fill:TEXTF,"font-family":"'Noto Serif', Georgia, serif",
        "font-weight":"600","font-size":String(WORD.size),opacity:"1"});
      lt.textContent = WORD_TEXT.charAt(i);
      openG.appendChild(lt); letters.push(lt);
    }
    if(!band) svg.appendChild(openG);

    /* ---- haze, then the journey's ribbons ---- */
    var hazeG = svgEl("g",{opacity:"0"}), haze=[];
    for(i=0;i<N_HAZE;i++){
      var hc = svgEl("circle",{r:"6",cx:"-50",cy:"-50",fill:HAZEF,opacity:"0"});
      hazeG.appendChild(hc); haze.push(hc);
    }
    var ribG = svgEl("g",{opacity:"0"}), ribs=[];
    for(i=0;i<N_RIBBON;i++){
      var rb = svgEl("path",{ d:"", fill:RIBF, stroke:"none", opacity:"0" });
      ribG.appendChild(rb); ribs.push(rb);
    }
    if(!band){ svg.appendChild(hazeG); svg.appendChild(ribG); }

    var goldFish = svgEl("g",{opacity:"0"});
    goldFish.appendChild(svgEl("path",{d:FISH_A_D,fill:"none",stroke:RIMF,"stroke-linecap":"round","stroke-width":STROKE_L}));
    goldFish.appendChild(svgEl("path",{d:FISH_B_D,fill:"none",stroke:RIMF,"stroke-linecap":"round","stroke-width":STROKE_L}));

    /* ---- the school (the arriving fish is one of them) ---- */
    var schoolG = svgEl("g",{}), fish=[];
    for(i=0;i<N_SCHOOL;i++){
      var g = svgEl("g",{opacity:"0"});
      var sr = [];
      for(var rr2=0; rr2<2; rr2++){
        var p = svgEl("path",{ d:"", fill:RIBL, stroke:"none", opacity:"0" });
        g.appendChild(p); sr.push(p);
      }
      var inkA = svgEl("path",{d:FISH_A_D,fill:"none",stroke:FISHF,"stroke-linecap":"round","stroke-width":STROKE_L});
      var inkB = svgEl("path",{d:FISH_B_D,fill:"none",stroke:FISHF,"stroke-linecap":"round","stroke-width":STROKE_L});
      g.appendChild(inkA); g.appendChild(inkB);
      var rim = svgEl("g",{opacity:"0", transform:"translate(-1.5 -2)"});
      rim.appendChild(svgEl("path",{d:FISH_A_D,fill:"none",stroke:RIMF,"stroke-linecap":"round","stroke-width":2.3}));
      rim.appendChild(svgEl("path",{d:FISH_B_D,fill:"none",stroke:RIMF,"stroke-linecap":"round","stroke-width":2.3}));
      g.appendChild(rim);
      schoolG.appendChild(g);
      fish.push({ g:g, rib:sr, rim:rim, inkA:inkA, inkB:inkB });
    }
    if(!band) svg.appendChild(goldFish);
    svg.appendChild(schoolG);

    var fishGlow = svgEl("circle",{r:"26",cx:"-99",cy:"-99",fill:HAZEF,opacity:"0"});
    var bloomG = svgEl("g",{}), blooms=[];
    for(i=0;i<N_BLOOM;i++){
      var bl = svgEl("circle",{r:"4",cx:"-50",cy:"-50",fill:HAZEF,opacity:"0"});
      bloomG.appendChild(bl); blooms.push(bl);
    }
    var dustG = svgEl("g",{}), tiers=[];
    for(i=0;i<TIERS;i++){
      var f2 = i/(TIERS-1);
      var col = f2 < 0.28 ? "var(--dust1)" : f2 < 0.56 ? "var(--dust2)" : f2 < 0.82 ? "var(--dust3)" : "var(--dust4)";
      var tp = svgEl("path",{ d:"", fill:"none", stroke:col, "stroke-linecap":"round",
        "stroke-width":(0.62 + f2*1.33).toFixed(2), opacity:"0" });
      dustG.appendChild(tp); tiers.push(tp);
    }
    var strG = svgEl("g",{}), streaks=[];
    var SCOL = ["var(--dust2)","var(--dust3)","var(--dust3)","var(--dust4)"], SWID = [0.55,0.75,0.95,1.15];
    for(i=0;i<4;i++){
      var spp = svgEl("path",{ d:"", fill:"none", stroke:SCOL[i], "stroke-linecap":"round",
        "stroke-linejoin":"round", "stroke-width":SWID[i], opacity:"0" });
      strG.appendChild(spp); streaks.push(spp);
    }
    if(!band){ svg.appendChild(fishGlow); svg.appendChild(bloomG); svg.appendChild(dustG); svg.appendChild(strG); }

    host.appendChild(svg);
    return { svg:svg, uid:uid, band:band, textGrad:textGrad, openG:openG, logoG:logoG, slot:slot,
             logoImg:logoImg, probe:probe, letters:letters, lx:null,
             hazeG:hazeG, haze:haze, ribG:ribG, ribs:ribs, schoolG:schoolG, fish:fish,
             goldFish:goldFish, fishGlow:fishGlow, bloomG:bloomG, blooms:blooms, dustG:dustG, tiers:tiers, strG:strG, streaks:streaks,
             dbg:{x:0,y:0,a:0,s:HERO} };
  }

  function setLogo(S, href){
    if(!href){ S.slot.setAttribute("visibility","visible"); S.logoImg.setAttribute("visibility","hidden"); return; }
    S.logoImg.setAttributeNS("http://www.w3.org/1999/xlink","href",href);
    S.logoImg.setAttribute("href", href);
    S.logoImg.setAttribute("visibility","visible");
    S.slot.setAttribute("visibility","hidden");
  }

  function layoutLetters(S){
    var xs=[], k;
    try{
      var total = S.probe.getComputedTextLength();
      for(k=0;k<WORD_TEXT.length;k++){
        var a=S.probe.getStartPositionOfChar(k), b=S.probe.getEndPositionOfChar(k);
        xs.push(WORD.x - total/2 + (a.x+b.x)/2);
      }
    }catch(e){
      var adv = WORD.size*0.78 + WORD.track;
      for(k=0;k<WORD_TEXT.length;k++) xs.push(WORD.x-(WORD_TEXT.length-1)*adv/2+k*adv);
    }
    S.lx = xs;
    for(k=0;k<WORD_TEXT.length;k++) setA(S.letters[k],"x",xs[k].toFixed(2));
  }

  /* a small tapered ribbon in a fish's own frame: it trails along -x */
  function localRibbon(R, t, s, boost){
    var len = R.len / s, n = SRIB_PTS, fwd = "", back = "", k;
    for(k=0;k<n;k++){
      var age = k/(n-1);
      var x = -34 - age*len;
      var y = (R.lat/s) * Math.sin(R.ph + age*3.4 + t*R.fr*1.6) * (0.3 + age*0.9);
      var half = (R.w/s) * Math.pow(1-age, 1.3) * Math.min(1, 0.3 + age*7) * boost;
      fwd  += (k ? "L" : "M") + x.toFixed(2) + " " + (y+half).toFixed(2) + " ";
      back  = "L" + x.toFixed(2) + " " + (y-half).toFixed(2) + " " + back;
    }
    return fwd + back + "Z";
  }

  /* ------------------------------------------------------------------
     One school member's pose at time t.
     ------------------------------------------------------------------ */
  function memberPose(M, t, ambient, resolveE, exitK){
    var sw = ambient;                        /* 0 while scrubbing the film's first half */
    var x = M.bx + sw*M.ax*Math.sin(t*M.wx + M.px) + (1-resolveE)*-26;
    var y = M.by + sw*M.ay*Math.sin(t*M.wy + M.py);
    var a = M.a0 + sw*M.ah*Math.sin(t*M.wh + M.ph);
    if(exitK > 0){
      var e = exitK*exitK*(3-2*exitK);
      x += e*(PHONE.w + 110 - M.bx*0.0);
      y -= e*26;
      a -= e*6;
    }
    return { x:x, y:y, a:a };
  }

  /* The compact state, for when the keyboard is open: the school tucks
     into one even row at the band's centre. Seven fish stay (the newcomer
     first, at the tail); the rest fade. Nothing is ever cut in half. */
  var COMPACT_KEEP = 7, COMPACT_Y = BAND.y0 + BAND.h/2;
  function compactOf(M, i, P, c){
    var e = ss(c), keep = i < COMPACT_KEEP;
    if(!keep) return { P:P, s:M.s, op:M.op*(1-e), rf:1-e };
    var tx = 52 + i*48, ty = COMPACT_Y + (i%2 ? 3 : -3);
    return { P:{ x:lerp(P.x,tx,e), y:lerp(P.y,ty,e), a:lerp(P.a,-6,e) },
             s:lerp(M.s,0.50,e), op:lerp(M.op,0.92,e), rf:1-e };
  }

  function renderBand(S, t, opts){
    COMPACT_Y = (opts.compactY != null ? opts.compactY : BAND.y0 + BAND.h/2);
    var amb = (opts.ambientT != null ? opts.ambientT : t);
    var exit = opts.exit || 0, c = opts.compact || 0;
    for(var i=0;i<N_SCHOOL;i++){
      var M = SCHOOL[i], F = S.fish[i];
      var ek = exit > 0 ? clamp((exit - M.delay*3)/(1 - M.delay*3), 0, 1) : 0;
      var P = memberPose(M, amb, 1, 1, ek), sc = M.s, op = M.op, rf = 1;
      if(c > 0){ var cb = compactOf(M, i, P, c); P = cb.P; sc = cb.s; op = cb.op; rf = cb.rf; }
      setA(F.g,"transform","translate("+P.x.toFixed(2)+" "+P.y.toFixed(2)+") rotate("+P.a.toFixed(2)+") scale("+sc.toFixed(4)+")");
      setA(F.g,"opacity", op.toFixed(3));
      var shine = opts.shine ? opts.shine(P.x,P.y) : 0;
      var rimOp = 0.12 + 0.55*shine + (exit>0 ? 0.35*ek*(1-ek)*4 : 0);
      setA(F.rim,"opacity", clamp(rimOp,0,1).toFixed(3));
      var boost = 1 + shine*0.8 + (exit>0 ? 1.4*ek : 0);
      for(var r=0;r<2;r++){
        var R = M.rib[r];
        setA(F.rib[r],"d", localRibbon(R, amb, sc, boost));
        setA(F.rib[r],"opacity", (clamp(R.op*(1 + 2.4*shine) + (exit>0 ? 0.30*ek : 0), 0, 0.7)*rf).toFixed(3));
      }
    }
  }

  function renderReduced(S, t){
    if(!S.lx) layoutLetters(S);
    var x = ss(span(t, 0, 0.5));
    setA(S.openG,"opacity",(1-x).toFixed(3));
    setA(S.hazeG,"opacity","0"); setA(S.ribG,"opacity","0"); setA(S.dustG,"opacity","0");
    setA(S.fishGlow,"opacity","0"); setA(S.bloomG,"opacity","0");
    setA(S.schoolG,"opacity", x.toFixed(3));
    renderBand(S, 5.0, { ambientT:0 });
  }

  /* ------------------------------------------------------------------ */
  function render(S, t, opts){
    opts = opts || {};
    COMPACT_Y = (opts.compactY != null ? opts.compactY : BAND.y0 + BAND.h/2);
    t = clamp(t, 0, T.total + 60);
    if(S.band){ renderBand(S, t, opts); return; }
    if(opts.reduced){ renderReduced(S, t); return; }
    if(!S.lx) layoutLetters(S);
    setA(S.openG,"opacity","1"); setA(S.hazeG,"opacity","0");
    setA(S.schoolG,"opacity","1"); setA(S.dustG,"opacity","1"); setA(S.bloomG,"opacity","1");

    var tc = Math.min(t, T.total);           /* choreography clock stops at the end */
    var midYpx = MID_Y_OPEN*K;
    var BAND_C = ((t*168) % 760) - 120;
    var BUCK = [], bti;
    for(bti=0;bti<TIERS;bti++) BUCK.push("");
    var BUCK2 = ["","","",""];
    function thread(p0, pm, p2, bright){
      if(bright <= 0.05) return;
      var ti = Math.min(3, Math.max(0, Math.round(bright*3)));
      /* a quadratic that passes through the middle sample */
      var qx = 2*pm.x - 0.5*(p0.x + p2.x), qy = 2*pm.y - 0.5*(p0.y + p2.y);
      BUCK2[ti] += "M" + p0.x.toFixed(1) + " " + p0.y.toFixed(1) + "Q" + qx.toFixed(1) + " " + qy.toFixed(1) + " " + p2.x.toFixed(1) + " " + p2.y.toFixed(1);
    }
    function dust(x, y, bright, rad){
      if(bright <= 0.05) return;
      var ti = Math.min(TIERS-1, Math.max(0, Math.round((bright*0.86 + rad*0.20)*(TIERS-1))));
      BUCK[ti] += "M" + x.toFixed(1) + " " + y.toFixed(1) + "l0 0";
    }

    /* ---- the mark and the word (opening space) ---- */
    var lo = ss(span(tc, T.logoOut[0], T.logoOut[1]));
    setA(S.logoG,"opacity",(1-lo).toFixed(3));
    setA(S.logoG,"transform","translate("+LOGO.x+" "+(LOGO.y + 18*lo).toFixed(2)+") scale("+(1-0.05*lo).toFixed(4)+") translate("+(-LOGO.x)+" "+(-LOGO.y)+")");
    var sheen = lerp(0, 118, ss(span(tc, T.release[0], T.release[1]-0.10)));
    setA(S.textGrad,"gradientTransform","translate("+sheen.toFixed(1)+" 0)");
    for(var L=0; L<9; L++){
      var rank = Math.abs(L-4);
      var d0 = T.release[0] + (4-rank)*0.07;
      var lp = 1 - ss(span(tc, d0, d0+0.34));
      setA(S.letters[L],"opacity", lp.toFixed(3));
      setA(S.letters[L],"transform", lp<0.999 ? "translate(0 "+(-2.6*(1-lp)).toFixed(2)+")" : "translate(0 0)");
    }

    /* ---- where the fish is, and how big ---- */
    var p = fishAt(tc), dist = p*PATH.L;
    atP(p, _q);
    var sc = fishScale(tc);
    var depthK = sc/HERO;
    var gather = ss(span(tc, T.join[0], T.join[0]+0.60));
    var formOp = ss(span(tc, 1.12, 1.52));
    var joinE = ss(span(tc, 2.90, 3.55));
    var fishOp = formOp * lerp(1, MID_OP, joinE);
    var resolveE = ss(span(tc, T.resolve[0], T.resolve[1]));
    var settled = ss(span(tc, T.settle[0], T.settle[1]));
    var goldEnv = ss(span(tc, T.gold[0], T.gold[0]+0.18)) * (1 - ss(span(tc, T.gold[1]-0.22, T.gold[1])));
    var AXC = Math.cos(-10*Math.PI/180), AXS = Math.sin(-10*Math.PI/180);
    var bandS = lerp(-40, 300, ss(span(tc, T.gold[0], T.gold[1])));
    function shineAt(x,y){ var sp=(x-J.x)*AXC+(y-J.y)*AXS, d=(sp-bandS)/74; return goldEnv*Math.exp(-0.5*d*d); }

    S.dbg.x=_q.x; S.dbg.y=_q.y; S.dbg.a=_q.a; S.dbg.s=sc;

    /* ---- the school ---- */
    var cmp = opts.compact || 0;
    for(var m=0; m<N_SCHOOL; m++){
      var M = SCHOOL[m], F = S.fish[m];
      if(M.user){
        /* the arriving fish: path pose until it lands, then it sways like the rest */
        if(cmp > 0){
          var Pu = memberPose(M, t, 1, 1, 0), cu = compactOf(M, m, Pu, cmp);
          setA(F.g,"transform","translate("+cu.P.x.toFixed(2)+" "+cu.P.y.toFixed(2)+") rotate("+cu.P.a.toFixed(2)+") scale("+cu.s.toFixed(4)+")");
          setA(F.g,"opacity", cu.op.toFixed(3));
          setA(F.rim,"opacity","0.12"); setA(F.rib[0],"opacity","0"); setA(F.rib[1],"opacity","0");
          continue;
        }
        var wS = ss(span(tc, 3.30, 3.95));
        var sx = M.ax*Math.sin(tc*M.wx + M.px)*wS, sy = M.ay*Math.sin(tc*M.wy + M.py)*wS;
        var ang = _q.a + (M.a0 + M.ah*Math.sin(tc*M.wh + M.ph) - _q.a)*wS;
        setA(F.g,"transform","translate("+(_q.x+sx).toFixed(2)+" "+(_q.y+sy).toFixed(2)+") rotate("+ang.toFixed(2)+") scale("+sc.toFixed(4)+")");
        setA(F.g,"opacity", fishOp.toFixed(3));
        var sh0 = shineAt(_q.x,_q.y);
        setA(F.rim,"opacity", clamp(0.12*joinE + 0.55*sh0,0,1).toFixed(3));
        setA(F.rib[0],"opacity","0"); setA(F.rib[1],"opacity","0");
        continue;
      }
      var vis = resolveE * clamp((resolveE*1.25) - M.delay*2, 0, 1);
      var ambK = ss(span(tc, T.resolve[0]+0.2, T.resolve[1]));
      var P = memberPose(M, t, ambK, resolveE, 0);
      /* make room: the nearest neighbours ease aside as the fish arrives */
      var dxJ = M.bx - J.x, dyJ = M.by - J.y, dJ = Math.hypot(dxJ, dyJ);
      var room = Math.sin(Math.PI*span(tc, 3.20, 4.50)); room = room*room;
      var push = room * 9 / (1 + dJ/55);
      P.x += (dxJ/(dJ||1))*push; P.y += (dyJ/(dJ||1))*push;
      var scm = M.s, opm = M.op*vis, rfm = 1;
      if(cmp > 0){ var cm = compactOf(M, m, P, cmp); P = cm.P; scm = cm.s; opm = cm.op*vis; rfm = cm.rf; }
      setA(F.g,"transform","translate("+P.x.toFixed(2)+" "+P.y.toFixed(2)+") rotate("+P.a.toFixed(2)+") scale("+scm.toFixed(4)+")");
      setA(F.g,"opacity",opm.toFixed(3));
      var shine = shineAt(P.x,P.y);
      var restRim = 0.12*settled + 0.04;
      setA(F.rim,"opacity", clamp(restRim + 0.95*shine,0,1).toFixed(3));
      var boost = 1 + shine*1.5;
      for(var r=0;r<2;r++){
        var R = M.rib[r];
        setA(F.rib[r],"d", localRibbon(R, t, scm, boost));
        setA(F.rib[r],"opacity", (clamp(R.op*(0.6 + 0.4*settled)*(1 + 4.2*shine),0,0.85)*rfm).toFixed(3));
      }
      if(shine > 0.22){
        var gl2 = shine*(0.65 + 0.35*Math.sin(tc*11 + M.px*4));
        dust(P.x - 11*M.s, P.y - 12*M.s, Math.min(1, gl2*1.15), 0.9);
        if(shine > 0.5) dust(P.x + 9*M.s, P.y + 8*M.s, Math.min(1, gl2*0.9), 0.7);
      }
    }

    /* ---- the fish is gold when it forms, then cools into ink ---- */
    var goldOp = ss(span(tc, 0.78, 1.12)) * (1 - ss(span(tc, 1.22, 1.60)));
    setA(S.goldFish,"transform","translate("+F0.x.toFixed(2)+" "+F0.y.toFixed(2)+") rotate("+PA[0].toFixed(2)+") scale("+HERO.toFixed(4)+")");
    setA(S.goldFish,"opacity", goldOp.toFixed(3));

    /* ---- glow under the arriving fish ---- */
    var glowOp = fishOp * (0.30 + 0.16*Math.sin(tc*2.3)) * (1 - gather*0.6) * (1 - ss(span(tc, 3.9, 4.4)));
    setA(S.fishGlow,"cx",_q.x.toFixed(2)); setA(S.fishGlow,"cy",_q.y.toFixed(2));
    setA(S.fishGlow,"r",((20 + 4*Math.sin(tc*1.7))*depthK).toFixed(2));
    setA(S.fishGlow,"opacity", Math.max(0,glowOp).toFixed(3));

    /* ---- haze around the fish while it flies ---- */
    var hazeOn = ss(span(tc, T.swim[0], T.swim[0]+0.25)) * (1 - ss(span(tc, T.join[0]+0.2, T.join[0]+0.9)));
    setA(S.hazeG,"opacity", hazeOn.toFixed(3));
    if(hazeOn > 0.004){
      for(var h=0; h<N_HAZE; h++){
        var H = HAZE[h];
        atP(Math.max(0, p - H.lag), _r);
        var hw = Math.sin(tc*H.fr + H.ph)*H.amp*depthK, hr = (_r.a+90)*Math.PI/180;
        setA(S.haze[h],"cx",(_r.x + Math.cos(hr)*hw).toFixed(2));
        setA(S.haze[h],"cy",(_r.y + Math.sin(hr)*hw).toFixed(2));
        setA(S.haze[h],"r",(H.r*depthK).toFixed(2));
        setA(S.haze[h],"opacity",H.op.toFixed(3));
      }
    }

    /* ---- the flowing gold: five tapered ribbons behind the fish ---- */
    var ribOn = ss(span(tc, T.swim[0]+0.05, T.swim[0]+0.40)) * (1 - ss(span(tc, T.join[0]+0.30, T.join[0]+0.95)));
    setA(S.ribG,"opacity", ribOn.toFixed(3));
    if(ribOn > 0.004){
      for(var ri=0; ri<N_RIBBON; ri++){
        var RB = RIBBON[ri];
        var ribLen = RB.len*(1 - gather*0.72), latAmp = RB.lat*(1 - gather*0.55);
        var fwd = "", back = "", any = false, mid = 0;
        for(var rk=0; rk<RIB_PTS; rk++){
          var age = rk/(RIB_PTS-1), dd = dist - RB.lag - age*ribLen;
          if(dd < 0) break;
          atP(dd/PATH.L, _r);
          var wob = Math.sin(RB.ph + age*3.4 + tc*RB.fr*2.0);
          var off = latAmp*wob*(0.30 + age*0.95)*depthK;
          var half = RB.w*Math.pow(1-age,1.30)*Math.min(1,0.30+age*7)*(1-gather*0.28)*depthK*1.15;
          var rr = (_r.a+90)*Math.PI/180, cxr = Math.cos(rr), cyr = Math.sin(rr);
          var bx = _r.x + cxr*off, by = _r.y + cyr*off;
          fwd  += (any ? "L" : "M") + (bx+cxr*half).toFixed(2) + " " + (by+cyr*half).toFixed(2) + " ";
          back  = "L" + (bx-cxr*half).toFixed(2) + " " + (by-cyr*half).toFixed(2) + " " + back;
          if(rk === (RIB_PTS>>1)) mid = bx*0.55 + by*0.84;
          any = true;
        }
        if(!any){ setA(S.ribs[ri],"opacity","0"); continue; }
        setA(S.ribs[ri],"d", fwd + back + "Z");
        var mbd = mid - BAND_C, mban = Math.exp(-(mbd*mbd)/(2*130*130));
        setA(S.ribs[ri],"opacity",(RB.op*(0.72 + 0.46*mban)).toFixed(3));
      }
    }

    /* ---- the motes that ride the ribbons ---- */
    for(var i=0;i<N_WIND;i++){
      var W = WIND[i];
      if(tc < W.b){ W.op = 0; W.sh = 0; continue; }
      var wage = tc - W.b;
      var dRel = fishAt(W.b)*PATH.L, ddw = dist - dRel;
      if(ddw < 0){ W.op = 0; W.sh = 0; continue; }
      var RR = RIBBON[W.rib];
      var aN = clamp(ddw / (RR.len*(1 - gather*0.72)), 0, 1);
      atP(dRel/PATH.L, _r);
      var wob2 = Math.sin(RR.ph + aN*3.4 + tc*RR.fr*2.0);
      var off2 = (RR.lat*(1 - gather*0.55)*wob2*(0.30 + aN*0.95) + W.jit*(0.55 + wage*1.7))*depthK;
      var rr2 = (_r.a+90)*Math.PI/180;
      var px = _r.x + Math.cos(rr2)*off2;
      var py = _r.y + Math.sin(rr2)*off2 + W.rise*wage*wage*0.30;
      var fl = Math.sin(tc*W.fr + W.ph)*W.amp*0.35*Math.min(1, wage*2.2)*depthK;
      px += Math.cos(rr2)*fl; py += Math.sin(rr2)*fl;
      if(gather > 0){ px = lerp(px, _q.x, gather*0.88); py = lerp(py, _q.y, gather*0.88); }

      var lifeT = clamp(Math.max(wage/W.life, aN), 0, 1);
      if(gather > 0){
        var far = clamp((Math.hypot(px-_q.x, py-_q.y) - 34)/90, 0, 1);
        lifeT = clamp(lifeT + far*gather*0.85, 0, 1);
      }
      var op = Math.min(1, wage/0.07)*(1 - lifeT*lifeT)*(1 - ss(span(tc, T.join[0]+0.35, T.join[0]+0.95)));
      op = clamp(op,0,1);
      var gl = Math.pow(Math.max(0, Math.sin(tc*W.gf + W.gp)), 6);
      var axis = px*0.55 + py*0.84, bandD = axis - BAND_C;
      var band = Math.exp(-(bandD*bandD)/(2*112*112));
      var shine2 = Math.min(1, gl*0.85 + band*0.80);
      op = Math.min(1, op*(1 + 0.42*band));
      W.px = px; W.py = py; W.op = op; W.sh = shine2;
      dust(px, py, Math.min(1, op*(0.28 + 0.80*shine2)*(0.44 + 0.74*W.tb))*0.70, W.r*(1-0.24*lifeT)*Math.max(0.7,depthK));
    }

    /* ---- the word becomes the fish: motes fly from the letters to the outline ---- */
    var rot0 = PA[0]*Math.PI/180, ca0 = Math.cos(rot0), sa0 = Math.sin(rot0);
    for(var j=0;j<N_FISH;j++){
      if(j & 1) continue;
      var FP = FISHP[j];
      var rk2 = Math.abs(FP.li-4);
      var st0 = T.release[0] + (4-rk2)*0.07 + FP.delay;
      var w = span(tc, st0, st0 + 0.66);
      if(w <= 0 || w >= 1) continue;
      var lxp = FP.src[0]*HERO, lyp = FP.src[1]*HERO;
      var ex = F0.x + lxp*ca0 - lyp*sa0, ey = F0.y + lxp*sa0 + lyp*ca0;       /* on the fish */
      var bx0 = S.lx[FP.li]*K + OX + FP.jx*K, by0 = midYpx + FP.jy*K;           /* in the letter */
      var mx = (bx0+ex)/2, my = (by0+ey)/2;
      var nx = -(ey-by0), ny = (ex-bx0), nl = Math.hypot(nx,ny)||1;
      var cx2 = mx + nx/nl*FP.curl*K*0.8, cy2 = my + ny/nl*FP.curl*K*0.8;
      function bez(wv, out){
        var e = ss(wv), m = 1-e;
        out.x = m*m*bx0 + 2*m*e*cx2 + e*e*ex; out.y = m*m*by0 + 2*m*e*cy2 + e*e*ey;
      }
      var cur = {x:0,y:0}, mid = {x:0,y:0}, prv = {x:0,y:0};
      bez(w, cur); bez(Math.max(0, w-0.23), mid); bez(Math.max(0, w-0.46), prv);
      var fop = Math.min(1, w/0.12)*(1 - ss(span(w,0.78,1)));
      var fax = cur.x*0.55 + cur.y*0.84, fbd = fax - BAND_C, fsh = Math.exp(-(fbd*fbd)/(2*112*112));
      thread(prv, mid, cur, Math.min(1, fop*(0.55 + 0.60*fsh)*(0.60 + 0.55*FP.tb)));
    }

    for(var ti2=0; ti2<4; ti2++){
      setA(S.streaks[ti2], "d", BUCK2[ti2]);
      setA(S.streaks[ti2], "opacity", BUCK2[ti2] ? (0.50 + ti2*0.16).toFixed(3) : "0");
    }
    for(bti=0;bti<TIERS;bti++){
      setA(S.tiers[bti], "d", BUCK[bti]);
      setA(S.tiers[bti], "opacity", BUCK[bti] ? (0.30 + (bti/(TIERS-1))*0.70).toFixed(3) : "0");
    }
    for(var bi=0; bi<N_BLOOM; bi++){
      var BW = WIND[(bi*13 + 5) % N_WIND], bc = S.blooms[bi];
      if(!BW || BW.op <= 0.05 || BW.sh <= 0.40){ setA(bc,"opacity","0"); continue; }
      setA(bc,"cx", BW.px.toFixed(2)); setA(bc,"cy", BW.py.toFixed(2));
      setA(bc,"r", (2.0 + BW.r*5.0).toFixed(2));
      setA(bc,"opacity",(BW.sh*BW.op*0.40).toFixed(3));
    }
  }

  /* how far each part of the form has risen at time t, 0..1 */
  function formProgress(t){
    function f(a){ return ss(span(t, a, a+0.55)); }
    return { header:f(T.form[0]-0.10), title:f(T.form[0]), support:f(T.form[0]+0.07),
             input:f(T.form[0]+0.14), cta:f(T.form[0]+0.21) };
  }

  global.MaranathaOnboarding = {
    T:T, DURATION:T.total, PHONE:PHONE, K:K, OX:OX, BAND:BAND, J:J, F0:F0, HERO:HERO, MID_S:MID_S,
    PATH:PATH, SCHOOL_DEF:SCHOOL_DEF, LAYER:LAYER, WORD_TEXT:WORD_TEXT,
    buildTable:buildTable, buildParticles:buildParticles, buildScene:buildScene,
    setLogo:setLogo, render:render, formProgress:formProgress,
    pathAt:function(p){ var o={x:0,y:0,a:0}; atP(p,o); return o; },
    fishAt:fishAt, fishScale:fishScale, progress:progress,
    FISH_A_D:FISH_A_D, FISH_B_D:FISH_B_D, STROKE_L:STROKE_L
  };
})(window);
