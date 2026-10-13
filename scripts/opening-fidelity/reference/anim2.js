/* ====================================================================
   MARANATHA OPENING — v6
   "The fish is carrying golden wind to Maranatha,
    and that golden wind becomes Maranatha."

   The gold is no longer a stroke. It is a cloud of particles the fish
   sheds as it flies, which slows and gathers when the fish slows, and
   which then flows into the letters. The fish itself breaks into the
   same gold and travels with it.
   ==================================================================== */
(function(global){
  "use strict";

  var VB   = { w:320, h:660 };
  var LOGO = { x:160, y:282, r:58 };
  var WORD = { x:160, y:396, size:16, track:3.0 };
  var WORD_TEXT = "MARANATHA";

  /* The approved flight. Ends at rest just below the mark. */
  var FLIGHT =
    "M 400 470 " +
    "C 330 452 262 420 214 372 " +
    "C 186 344 150 330 118 320 " +
    "C 86 310 66 276 74 240 " +
    "C 82 204 116 178 152 176 " +
    "C 188 174 218 196 226 228 " +
    "C 234 260 224 296 200 320 " +
    "C 192 336 180 358 172 376 " +
    "C 168 384 164 388 160 390";

  var FISH_A = [ 40,0,  22,-18,  -2,-18, -22,0, -30, 8, -36, 12, -40, 15];
  var FISH_B = [ 40,0,  22, 18,  -2, 18, -22,0, -30,-8, -36,-12, -40,-15];
  var FISH_SCALE = 0.58;

  var N_WIND = 96, N_FISH = 120, N_HAZE = 14, N_RIBBON = 5, N_BLOOM = 14;
  /* Brightness tiers. Each tier is ONE path holding every mote at that
     brightness, drawn as zero-length round-capped segments. 300 motes
     cost 8 attribute writes a frame instead of 1200, which is what
     makes a dense stream affordable at all -- and as the specular band
     sweeps through, motes MIGRATE between tiers, which is the shimmer. */
  var TIERS = 8;
  var RIB_PTS = 26;

  var SPEED = 1.34;   /* wall-clock seconds per animation second */
  var T = {
    logoIn   : [0.00, 0.55],
    flight   : [0.70, 2.55],
    /* The gather now OVERLAPS the end of the flight, and the dissolve
       starts as soon as the fish is still. The fish reaches 99.2% of
       the path by t=2.24, so with the old 2.62 dissolve it sat
       motionless for eight tenths of a second -- a fifth of the whole
       film with nothing moving. The gold is in motion throughout now. */
    gather   : [1.92, 2.42],
    dissolve : [2.35, 3.15],   /* starts BEFORE the flight ends */
    letters  : [3.05, 3.68],
    hold     : [3.68, 4.02],
    total    : 4.02
  };
  var EMIT = [0.70, 2.44];

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function ss(t){ t=clamp(t,0,1); return t*t*(3-2*t); }
  function span(t,a,b){ return clamp((t-a)/(b-a),0,1); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function toPath(n){
    return "M "+n[0]+" "+n[1]+
           " C "+n[2]+" "+n[3]+" "+n[4]+" "+n[5]+" "+n[6]+" "+n[7]+
           " C "+n[8]+" "+n[9]+" "+n[10]+" "+n[11]+" "+n[12]+" "+n[13];
  }
  var FISH_A_D = toPath(FISH_A), FISH_B_D = toPath(FISH_B);

  /* Fixed-seed PRNG: every particle's constants are decided once, so
     render(t) stays a pure function of t and a scrub matches playback
     frame for frame. */
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

  /* ---- speed along the flight: monotone cubic, decelerating to rest -- */
  var KU = [0, 0.12, 0.30, 0.48, 0.62, 0.76, 0.88, 0.96, 1.00];
  var KP = [0, 0.20, 0.34, 0.47, 0.56, 0.74, 0.90, 0.960, 1.00];
  var KM = (function(){
    var n=KU.length, d=[], m=[], i;
    for(i=0;i<n-1;i++) d.push((KP[i+1]-KP[i])/(KU[i+1]-KU[i]));
    m.push(d[0]);
    for(i=1;i<n-1;i++) m.push((d[i-1]+d[i])/2);
    m.push(d[n-2]);
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
  function fishAt(t){ return progress(span(t, T.flight[0], T.flight[1])); }

  /* ---- path + fish outline, sampled once ---- */
  var SEQ = 0;
  var NS_PTS = 800, FLEN = 1200;
  /* NATURAL BANKING, WITH THE TUMBLE SMOOTHED OUT.

     The fish faces where it is going -- the whole way, as it did in the
     rendered videos. v8 froze the heading instead, which stopped the
     spin but started something worse: the fish was still TRAVELLING
     until 2.30s, so a locked nose meant it slid sideways.

     The tumble is not in the fish, it is in the path. Measured, the raw
     tangent swings 93 degrees in 0.16s and then reverses twice
     (134 -> 116 -> 128) inside the final bend. So the tangent itself is
     low-passed before anything reads it: three symmetric smoothing
     passes over the sampled heading. Symmetric, so it does not lag the
     motion -- the fish still points along its flight, it just cannot
     snap or double back. */
  function smoothHeadings(arr, n, halfWidth, passes){
    var src = arr, i, k, a, b, sum, cnt, out;
    for(k=0;k<passes;k++){
      out = new Float64Array(n);
      for(i=0;i<n;i++){
        sum = 0; cnt = 0;
        for(a=i-halfWidth; a<=i+halfWidth; a++){
          b = a < 0 ? 0 : (a >= n ? n-1 : a);   /* replicate the edges */
          sum += src[b]; cnt++;
        }
        out[i] = sum/cnt;
      }
      src = out;
    }
    return src;
  }

  var SX = new Float64Array(NS_PTS), SY = new Float64Array(NS_PTS), SA = new Float64Array(NS_PTS);
  var FISH_PTS = [];
  function buildTable(){
    var holder = svgEl("svg",{width:"0",height:"0"});
    holder.setAttribute("style","position:absolute;width:0;height:0;overflow:hidden");
    var p = svgEl("path",{d:FLIGHT});
    var fa = svgEl("path",{d:FISH_A_D}), fb = svgEl("path",{d:FISH_B_D});
    holder.appendChild(p); holder.appendChild(fa); holder.appendChild(fb);
    document.body.appendChild(holder);
    try{
      FLEN = p.getTotalLength();
      var i,d,a,b,prev=0;
      for(i=0;i<NS_PTS;i++){
        d=(i/(NS_PTS-1))*FLEN;
        a=p.getPointAtLength(d);
        /* Heading from a FORWARD difference, except at the very end
           where d+1 clamps back to d: getPointAtLength would hand back
           the same point and atan2(0,0) returns 0, snapping the fish
           through ~120 degrees in its final instant. Since it is also
           decelerating hardest there, it then SAT at the wrong angle
           for many frames -- which is the spin. Measure backwards. */
        var ang;
        if(d + 1.0 <= FLEN){
          b = p.getPointAtLength(d + 1.0);
          ang = Math.atan2(b.y-a.y, b.x-a.x)*180/Math.PI;
        } else {
          b = p.getPointAtLength(Math.max(0, d - 1.0));
          ang = Math.atan2(a.y-b.y, a.x-b.x)*180/Math.PI;
        }
        SX[i]=a.x; SY[i]=a.y;
        if(i>0){ while(ang-prev>180) ang-=360; while(ang-prev<-180) ang+=360; }
        SA[i]=ang; prev=ang;
      }
      /* The calm attitude it flares into: the nearest LEVEL heading to
         the one it is already carrying, so the correction is the
         smallest one possible and never a flip. It is travelling left
         by then, so level means nose-left. */
      SA = smoothHeadings(SA, NS_PTS, 46, 3);
      /* points ON the fish, so it dissolves into its own shape */
      [fa,fb].forEach(function(el){
        var L=el.getTotalLength(), k, m=N_FISH/2;
        for(k=0;k<m;k++){ var q=el.getPointAtLength(L*(k+0.5)/m); FISH_PTS.push([q.x,q.y]); }
      });
    }catch(e){
      for(var j=0;j<NS_PTS;j++){ SX[j]=160; SY[j]=390; SA[j]=0; }
      for(var z=0;z<N_FISH;z++) FISH_PTS.push([0,0]);
    }
    document.body.removeChild(holder);
  }
  function atP(p, out){
    var f = clamp(p,0,1)*(NS_PTS-1), i=f|0, r=f-i;
    if(i>=NS_PTS-1){ out.x=SX[NS_PTS-1]; out.y=SY[NS_PTS-1]; out.a=SA[NS_PTS-1]; return out; }
    out.x=SX[i]+(SX[i+1]-SX[i])*r; out.y=SY[i]+(SY[i+1]-SY[i])*r; out.a=SA[i]+(SA[i+1]-SA[i])*r;
    return out;
  }
  var _q={x:0,y:0,a:0}, _r={x:0,y:0,a:0};

  /* ---- the particles, decided once ---- */
  var WIND = [], FISHP = [], HAZE = [], RIBBON = [];
  function buildParticles(){
    var rnd = mulberry32(20260925), i;
    WIND.length = 0; FISHP.length = 0; HAZE.length = 0;

    for(i=0;i<N_WIND;i++){
      var f = (i + rnd()*0.8) / N_WIND;
      var b = lerp(EMIT[0], EMIT[1], f);
      WIND.push({
        b:b,
        rib:  i % N_RIBBON,               // the strand this mote rides
        jit:  (rnd()-0.5)*3.4,            // small scatter about that strand
        rise: -4 - rnd()*10,              // gentle buoyancy
        life: 0.54 + rnd()*0.46,
        amp: 1.2 + rnd()*3.4,             // flutter
        fr: 2.0 + rnd()*3.2,
        ph: rnd()*6.28,
        r: 0.26 + rnd()*0.66,
        tb: rnd(),             /* permanent tone bias */
        gf: 2.4 + rnd()*3.6,   /* glint rate */
        gp: rnd()*6.28,        /* glint phase */
        px:0, py:0, op:0,      /* scratch, filled each frame */
        li: 0                             // letter it later flows into
      });
    }
    for(i=0;i<N_FISH;i++){
      FISHP.push({
        src: FISH_PTS[i] || [0,0],
        delay: rnd()*0.10,
        tb: rnd(),
        curl: (rnd()-0.5)*44,
        r: 0.34 + rnd()*0.74,
        jx: (rnd()-0.5)*7,
        jy: (rnd()-0.5)*5.5,
        li: 0
      });
    }
    RIBBON.length = 0;
    for(i=0;i<N_RIBBON;i++){
      RIBBON.push({
        lag:  5 + i*6 + rnd()*6,
        len:  104 + rnd()*82,
        /* fanned apart, or five ribbons on the same line merge into one
           solid band -- which is what made it read as a gold snake */
        lat:  (i%2?1:-1) * (3.4 + i*2.4 + rnd()*4.0),
        w:    0.38 + rnd()*0.62,        /* delicate: the sketch is pencil arcs */
        fr:   1.4 + rnd()*1.6,
        ph:   rnd()*6.28,
        op:   0.34 + rnd()*0.28
      });
    }
    for(i=0;i<N_HAZE;i++){
      HAZE.push({
        lag: 0.006 + (i/N_HAZE)*0.075,
        r: 4 + rnd()*7.5,
        op: 0.038 + rnd()*0.040,
        amp: 2 + rnd()*5, fr: 1.4 + rnd()*2.0, ph: rnd()*6.28
      });
    }
    /* Assign every particle a letter, centre outward, so the word forms
       from the middle rather than left to right. */
    var order = [4,3,5,2,6,1,7,0,8];
    for(i=0;i<WIND.length;i++)  WIND[i].li  = order[i % 9];
    for(i=0;i<FISHP.length;i++) FISHP[i].li = order[i % 9];
  }

  /* ------------------------------------------------------------------ */
  function buildScene(host, opts){
    opts = opts || {};
    var svg = svgEl("svg",{ viewBox:"0 0 "+VB.w+" "+VB.h, preserveAspectRatio:"xMidYMid slice" });
    var uid = "mo" + (SEQ++);

    /* ---- METALLIC GOLD ----
       Flat fill cannot read as metal. Metal reads as metal because of
       the RANGE between a dark rim and a near-white specular, so every
       mote is filled with a radial gradient lit from the upper left:
       bright core, gold body, bronze rim. The base stop is the project's
       own accent token, unchanged -- the deep and bright stops are built
       around it rather than replacing it. */
    var defs = svgEl("defs",{});
    function grad(id, type, attrs, stops){
      var g = svgEl(type, Object.assign({id:id}, attrs));
      stops.forEach(function(s){
        g.appendChild(svgEl("stop",{offset:s[0],"stop-color":s[1],"stop-opacity":s[2]}));
      });
      defs.appendChild(g);
      return "url(#"+id+")";
    }
    var BEAD = grad(uid+"b","radialGradient",{cx:"0.32",cy:"0.26",r:"0.80"},[
      ["0",   "var(--gold-spec)", "1"],
      ["0.18","var(--gold-spec)", "1"],
      ["0.40","var(--gold-high)", "1"],
      ["0.70","var(--gold-base)", "1"],
      ["1",   "var(--gold-deep)", "0.96"]
    ]);
    var HAZEF = grad(uid+"h","radialGradient",{cx:"0.5",cy:"0.5",r:"0.5"},[
      ["0",   "var(--gold-high)", "0.55"],
      ["0.45","var(--gold-base)", "0.24"],
      ["1",   "var(--gold-base)", "0"]
    ]);
    /* The wordmark is the same metal: a sheen that sweeps across as the
       letters form, then settles with the highlight near the centre. */
    var RIBF = grad(uid+"r","linearGradient",{x1:"0",y1:"0",x2:"0.7",y2:"1"},[
      ["0",   "var(--gold-rim)",  "1"],
      ["0.30","var(--gold-base)", "1"],
      ["0.55","var(--dust4)",     "1"],
      ["0.80","var(--gold-base)", "1"],
      ["1",   "var(--gold-rim)",  "1"]
    ]);
    var TEXTF = "url(#"+uid+"t)";
    var textGrad = svgEl("linearGradient",{ id:uid+"t", gradientUnits:"userSpaceOnUse",
      x1:"84", y1:"384", x2:"236", y2:"402" });
    /* The wordmark's sheen peaks at a DIMMER gold than the motes do.
       The motes can carry a near-white specular because they are small
       and round; a letter filled with it simply disappears against
       paper -- the N was washing out entirely. */
    [["0","var(--gold-deep)"],["0.28","var(--gold-base)"],["0.46","var(--gold-textpeak)"],
     ["0.52","var(--gold-textpeak)"],["0.58","var(--gold-textpeak)"],["0.76","var(--gold-base)"],
     ["1","var(--gold-deep)"]].forEach(function(s){
      textGrad.appendChild(svgEl("stop",{offset:s[0],"stop-color":s[1]}));
    });
    defs.appendChild(textGrad);
    /* The fish is the same metal as the gold it carries -- a flat stroke
       beside metallic motes reads as two different materials. */
    var fishGrad = svgEl("linearGradient",{ id:uid+"f", gradientUnits:"objectBoundingBox",
      x1:"0", y1:"0", x2:"0.85", y2:"1" });
    /* THE FISH IS INK. The gold is what it CARRIES, not what it is --
       which is the whole story, and it matches the project's own
       ink-on-paper identity. A faint lift through the middle keeps the
       body from reading as a flat cut-out; everything that shimmers on
       screen is then unambiguously the cargo. */
    [["0","var(--scene-ink)"],["0.34","var(--ink-soft)"],["0.52","var(--ink-soft)"],
     ["0.70","var(--scene-ink)"],["1","var(--scene-ink)"]].forEach(function(st){
      fishGrad.appendChild(svgEl("stop",{offset:st[0],"stop-color":st[1]}));
    });
    defs.appendChild(fishGrad);
    var FISHF = "url(#"+uid+"f)";
    svg.appendChild(defs);

    svg.appendChild(svgEl("rect",{x:0,y:0,width:VB.w,height:VB.h,fill:"var(--scene-ground)"}));

    /* soft haze — the cloud the particles sit inside */
    var hazeG = svgEl("g",{opacity:"0"}), haze=[], i;
    for(i=0;i<N_HAZE;i++){
      var hc = svgEl("circle",{r:"6",cx:"-50",cy:"-50",fill:HAZEF,opacity:"0"});
      hazeG.appendChild(hc); haze.push(hc);
    }
    svg.appendChild(hazeG);

    /* THE FLOWING GOLD.
       Filled, tapered ribbons -- not strokes. A stroke carries one
       width for its whole length, which is why every earlier attempt
       read as wire or as scattered specks. These are closed shapes
       built from two offset edges, wide at the head and narrowing to
       nothing at the tail: the pencil arcs from the storyboard. */
    var ribG = svgEl("g",{opacity:"0"}), ribs=[];
    for(i=0;i<N_RIBBON;i++){
      var rb = svgEl("path",{ d:"", fill:RIBF, stroke:"none", opacity:"0" });
      ribG.appendChild(rb); ribs.push(rb);
    }
    svg.appendChild(ribG);

    /* ---- THE LOGO. A real image when one is supplied, a marked slot
            when it is not. Never a substitute mark. ---- */
    var logoG = svgEl("g",{opacity:"0"});
    var slot = svgEl("g",{});
    slot.appendChild(svgEl("circle",{cx:LOGO.x,cy:LOGO.y,r:LOGO.r,fill:"var(--scene-ink)","fill-opacity":".05"}));
    slot.appendChild(svgEl("circle",{cx:LOGO.x,cy:LOGO.y,r:LOGO.r,fill:"none",stroke:"var(--scene-ink)",
      "stroke-width":"1.1","stroke-opacity":".45","stroke-dasharray":"4 4"}));
    var slotTxt = svgEl("text",{x:LOGO.x,y:LOGO.y+3.5,"text-anchor":"middle",fill:"var(--scene-ink)",
      "fill-opacity":".28","font-size":"7.5","font-family":"ui-monospace, monospace","letter-spacing":".1em"});
    slotTxt.textContent = "YOUR LOGO";
    slot.appendChild(slotTxt);
    logoG.appendChild(slot);
    var logoImg = svgEl("image",{ x:(LOGO.x-LOGO.r), y:(LOGO.y-LOGO.r),
      width:(LOGO.r*2), height:(LOGO.r*2),
      preserveAspectRatio:"xMidYMid meet", visibility:"hidden" });
    logoG.appendChild(logoImg);
    svg.appendChild(logoG);

    /* a soft bloom the fish itself carries, so it reads as lit rather than drawn */
    var fishGlow = svgEl("circle",{r:"26",cx:"-99",cy:"-99",fill:HAZEF,opacity:"0"});
    svg.appendChild(fishGlow);

    /* the fish, in gold */
    var fishG = svgEl("g",{opacity:"0"});
    fishG.appendChild(svgEl("path",{d:FISH_A_D,fill:"none",stroke:FISHF,
      "stroke-linecap":"round","stroke-width":(3.2/FISH_SCALE)}));
    fishG.appendChild(svgEl("path",{d:FISH_B_D,fill:"none",stroke:FISHF,
      "stroke-linecap":"round","stroke-width":(3.2/FISH_SCALE)}));
    svg.appendChild(fishG);

    /* Bloom: a soft halo under only the brightest motes. Restrained --
       it follows the shine, so most of the cloud never blooms at all. */
    var bloomG = svgEl("g",{}), blooms=[];
    for(i=0;i<N_BLOOM;i++){
      var bl = svgEl("circle",{r:"4",cx:"-50",cy:"-50",fill:HAZEF,opacity:"0"});
      bloomG.appendChild(bl); blooms.push(bl);
    }
    svg.appendChild(bloomG);

    /* the carried gold, and what the fish becomes -- one material,
       drawn as eight brightness tiers */
    var dustG = svgEl("g",{}), tiers=[];
    for(i=0;i<TIERS;i++){
      var f = i/(TIERS-1);
      var col = f < 0.28 ? "var(--dust1)"
              : f < 0.56 ? "var(--dust2)"
              : f < 0.82 ? "var(--dust3)"
              :            "var(--dust4)";
      /* brighter motes are also bigger: catching the light is what
         makes a speck read as larger than it is */
      var tp = svgEl("path",{ d:"", fill:"none", stroke:col,
        "stroke-linecap":"round", "stroke-width":(0.62 + f*1.33).toFixed(2),
        opacity:"0" });
      dustG.appendChild(tp); tiers.push(tp);
    }
    svg.appendChild(dustG);



    /* measuring text, never painted */
    var probe = svgEl("text",{x:"0",y:"0","text-anchor":"start",
      "font-family":"'Noto Serif', Georgia, serif","font-weight":"600",
      "font-size":String(WORD.size),"letter-spacing":String(WORD.track),visibility:"hidden"});
    probe.textContent = WORD_TEXT;
    svg.appendChild(probe);

    var letters=[];
    for(i=0;i<WORD_TEXT.length;i++){
      var lt = svgEl("text",{x:"0",y:String(WORD.y),"text-anchor":"middle",
        fill:TEXTF,"font-family":"'Noto Serif', Georgia, serif",
        "font-weight":"600","font-size":String(WORD.size),opacity:"0"});
      lt.textContent = WORD_TEXT.charAt(i);
      svg.appendChild(lt); letters.push(lt);
    }

    host.appendChild(svg);
    return { svg:svg, uid:uid, textGrad:textGrad, fishGlow:fishGlow,
             bloomG:bloomG, blooms:blooms,
             hazeG:hazeG, haze:haze, ribG:ribG, ribs:ribs,
             logoG:logoG, slot:slot, logoImg:logoImg, hasLogo:false,
             fishG:fishG, dustG:dustG, tiers:tiers,
             probe:probe, letters:letters, lx:null };
  }

  function setLogo(S, href){
    if(!href){ S.hasLogo=false; S.slot.setAttribute("visibility","visible");
      S.logoImg.setAttribute("visibility","hidden"); return; }
    S.hasLogo = true;
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

  /* ------------------------------------------------------------------ */
  function render(S, t){
    t = clamp(t, 0, T.total*SPEED) / SPEED;
    if(!S.lx) layoutLetters(S);

    var midY = WORD.y - WORD.size*0.34;
    /* the sweep, cycling slowly through the scene's diagonal */
    var BAND_C = ((t*168) % 760) - 120;
    var BUCK = [], bti;
    for(bti=0;bti<TIERS;bti++) BUCK.push("");
    function dust(x, y, bright, rad){
      if(bright <= 0.05) return;
      var ti = Math.min(TIERS-1, Math.max(0, Math.round((bright*0.86 + rad*0.20)*(TIERS-1))));
      /* A zero-length, round-capped segment renders as a dot whose
         diameter is the tier's stroke-width. Size therefore rides on
         brightness, which is why the ramp widens as it brightens. */
      BUCK[ti] += "M" + x.toFixed(1) + " " + y.toFixed(1) + "l0 0";
    }

    /* ---- the logo, present from the first half-second ---- */
    var inLogo = ss(span(t, T.logoIn[0], T.logoIn[1]));
    setA(S.logoG,"opacity", inLogo.toFixed(3));
    setA(S.logoG,"transform",
      "translate("+LOGO.x+" "+LOGO.y+") scale("+lerp(0.94,1,inLogo).toFixed(4)+
      ") translate("+(-LOGO.x)+" "+(-LOGO.y)+")");

    /* ---- where the fish is ---- */
    var p = fishAt(t);
    var dist = p * FLEN;
    atP(p, _q);
    var gather = ss(span(t, T.gather[0], T.gather[1]));
    var diss   = ss(span(t, T.dissolve[0], T.dissolve[1]));
    var fishOp = ss(span(t, T.flight[0], T.flight[0]+0.14)) * (1 - ss(span(t, T.dissolve[0], T.dissolve[0]+0.26)));

    /* ONE heading, used for the fish and for where its motes come from,
       so the two can never disagree: the fish and the motes that come
       off it are always on the same axis. */
    var ang = _q.a;
    setA(S.fishG,"opacity", fishOp.toFixed(3));
    setA(S.fishG,"transform",
      "translate("+_q.x.toFixed(2)+" "+_q.y.toFixed(2)+") rotate("+ang.toFixed(2)+") scale("+FISH_SCALE+")");

    var glowOp = fishOp * (0.34 + 0.20*Math.sin(t*2.3));
    setA(S.fishGlow,"cx",_q.x.toFixed(2));
    setA(S.fishGlow,"cy",_q.y.toFixed(2));
    setA(S.fishGlow,"r",(20 + 4*Math.sin(t*1.7)).toFixed(2));
    setA(S.fishGlow,"opacity", Math.max(0,glowOp).toFixed(3));

    /* ---- haze: the cloud the fish moves inside ---- */
    var hazeOn = ss(span(t, T.flight[0], T.flight[0]+0.22)) * (1 - ss(span(t, T.dissolve[0], T.dissolve[1]-0.1)));
    setA(S.hazeG,"opacity", hazeOn.toFixed(3));
    if(hazeOn > 0.004){
      for(var h=0;h<N_HAZE;h++){
        var H = HAZE[h];
        atP(Math.max(0, p - H.lag), _r);
        var hw = Math.sin(t*H.fr + H.ph) * H.amp;
        var hr = (_r.a+90)*Math.PI/180;
        setA(S.haze[h],"cx",(_r.x + Math.cos(hr)*hw).toFixed(2));
        setA(S.haze[h],"cy",(_r.y + Math.sin(hr)*hw).toFixed(2));
        setA(S.haze[h],"r", H.r.toFixed(2));
        setA(S.haze[h],"opacity", H.op.toFixed(3));
      }
    }

    /* ---- THE FLOWING GOLD ----
       Each ribbon is sampled along the path behind the fish, given a
       lateral drift that grows toward its tail, and closed into a
       tapered shape. Its width fades to zero at the tail, so the gold
       streams and thins the way the storyboard draws it, instead of
       ending on a hard edge. */
    var ribOn = ss(span(t, T.flight[0], T.flight[0]+0.20))
              * (1 - ss(span(t, T.dissolve[0]-0.06, T.dissolve[0]+0.30)));
    setA(S.ribG,"opacity", ribOn.toFixed(3));
    if(ribOn > 0.004){
      for(var ri=0; ri<N_RIBBON; ri++){
        var R = RIBBON[ri];
        /* the gather shortens and tightens each ribbon toward the fish */
        var ribLen = R.len * (1 - gather*0.72);
        var latAmp = R.lat * (1 - gather*0.55);
        var fwd = "", back = "", any = false, mid = 0;
        for(var rk=0; rk<RIB_PTS; rk++){
          var age = rk/(RIB_PTS-1);
          var dd = dist - R.lag - age*ribLen;
          if(dd < 0) break;
          atP(dd/FLEN, _r);
          var wob = Math.sin(R.ph + age*3.4 + t*R.fr*2.0);
          var off = latAmp * wob * (0.30 + age*0.95);
          var half = R.w * Math.pow(1-age, 1.30) * Math.min(1, 0.30 + age*7) * (1 - gather*0.28);
          var rr = (_r.a + 90) * Math.PI/180;
          var cxr = Math.cos(rr), cyr = Math.sin(rr);
          var bx = _r.x + cxr*off, by = _r.y + cyr*off;
          fwd  += (any ? "L" : "M") + (bx + cxr*half).toFixed(2) + " " + (by + cyr*half).toFixed(2) + " ";
          back  = "L" + (bx - cxr*half).toFixed(2) + " " + (by - cyr*half).toFixed(2) + " " + back;
          if(rk === (RIB_PTS>>1)) mid = bx*0.55 + by*0.84;
          any = true;
        }
        if(!any){ setA(S.ribs[ri],"opacity","0"); continue; }
        setA(S.ribs[ri],"d", fwd + back + "Z");
        /* the specular band travelling through lifts whichever ribbon
           it is crossing, so the shimmer moves along the flow */
        var mbd = mid - BAND_C;
        var mban = Math.exp(-(mbd*mbd)/(2*130*130));
        setA(S.ribs[ri],"opacity", (R.op * (0.72 + 0.46*mban)).toFixed(3));
      }
    }

    /* ---- THE CARRIED GOLD ----
       Each mote is released at the fish's position, drifts off its tail
       at a speed set by how fast the fish was going, and flutters as it
       fades. When the fish slows, the motes it sheds barely move -- so
       the cloud gathers around it without being told to. */
    for(var i=0;i<N_WIND;i++){
      var W = WIND[i];
      if(t < W.b){ W.op = 0; W.sh = 0; continue; }
      var age = t - W.b;

      /* A mote does NOT spray off the tail into open air -- that read as
         speckle scattered around the fish. It is released onto one of the
         ribbons and stays IN it, so the sparkle lives inside the gold
         instead of orbiting it. Its station is the path distance the fish
         had reached when it was shed; the fish moving on is what carries
         the ribbon past it. */
      var dRel = fishAt(W.b) * FLEN;
      var dd   = dist - dRel;
      if(dd < 0){ W.op = 0; W.sh = 0; continue; }

      var R  = RIBBON[W.rib];
      var aN = clamp(dd / (R.len * (1 - gather*0.72)), 0, 1);
      atP(dRel/FLEN, _r);
      var wob = Math.sin(R.ph + aN*3.4 + t*R.fr*2.0);
      var off = R.lat*(1 - gather*0.55)*wob*(0.30 + aN*0.95)
              + W.jit*(0.55 + age*1.7);
      var rr  = (_r.a + 90)*Math.PI/180;
      var px  = _r.x + Math.cos(rr)*off;
      var py  = _r.y + Math.sin(rr)*off + W.rise*age*age*0.30;
      var fl  = Math.sin(t*W.fr + W.ph) * W.amp * 0.35 * Math.min(1, age*2.2);
      px += Math.cos(rr)*fl; py += Math.sin(rr)*fl;

      /* THE GATHER. Pulled most of the way in, not half: at 0.55 the
         cloud stayed a wide ring around the mark and then slid off to
         the word as a ring, so the beat never read as gathering. */
      if(gather > 0){
        px = lerp(px, _q.x, gather*0.88);
        py = lerp(py, _q.y, gather*0.88);
      }
      /* then the gold flows into the letters */
      if(diss > 0){
        var e = ss(diss);
        px = lerp(px, S.lx[W.li], e);
        py = lerp(py, midY, e);
      }

      var lifeT = clamp(Math.max(age / W.life, aN), 0, 1);
      /* Anything still far from the fish when the gather starts is old
         trail. It dies where it is rather than being dragged along,
         which is what kept a ghost ring hanging around the mark. */
      if(gather > 0){
        var dfx = px - _q.x, dfy = py - _q.y;
        var far = clamp((Math.hypot(dfx,dfy) - 34)/90, 0, 1);
        lifeT = clamp(lifeT + far*gather*0.85, 0, 1);
      }
      var op = Math.min(1, age/0.07) * (1 - lifeT*lifeT) * (1 - ss(span(t, T.letters[0]+0.18, T.letters[1])));
      if(gather > 0) op = Math.max(op, op*0.4 + 0.45*gather*(1-lifeT*0.55));
      op = clamp(op,0,1);
      var gl = Math.pow(Math.max(0, Math.sin(t*W.gf + W.gp)), 6);
      /* A specular band travelling through the cloud: motes lying on it
         catch the light together, the way a sheet of metal does when it
         turns. This is what makes the gold look lit rather than tinted. */
      var axis = px*0.55 + py*0.84;
      var bandD = axis - BAND_C;
      var band = Math.exp(-(bandD*bandD)/(2*112*112));
      var shine = Math.min(1, gl*0.85 + band*0.80);
      op = Math.min(1, op * (1 + 0.42*band));
      W.px = px; W.py = py; W.op = op; W.gl = gl; W.sh = shine;
      dust(px, py, Math.min(1, op*(0.28 + 0.80*shine)*(0.44 + 0.74*W.tb)) * 0.70, W.r*(1-0.24*lifeT));
    }

    /* ---- THE FISH BECOMES THE WORD ----
       Motes taken from points ON the fish outline, at its final pose,
       each flying to the letter it belongs to. Centre letters first. */
    for(var j=0;j<N_FISH;j++){
      var F = FISHP[j];
      var st0 = T.dissolve[0] + F.delay + Math.abs(F.li-4)*0.045;
      var w = span(t, st0, st0 + 0.58);
      if(w <= 0) continue;

      var ca = Math.cos(ang*Math.PI/180), sa = Math.sin(ang*Math.PI/180);
      var lxp = F.src[0]*FISH_SCALE, lyp = F.src[1]*FISH_SCALE;
      var sx = _q.x + lxp*ca - lyp*sa, sy = _q.y + lxp*sa + lyp*ca;
      var tx = S.lx[F.li] + F.jx, ty = midY + F.jy;

      var mx = (sx+tx)/2, my = (sy+ty)/2;
      var nx = -(ty-sy), ny = (tx-sx), nl = Math.hypot(nx,ny)||1;
      var cx2 = mx + nx/nl*F.curl, cy2 = my + ny/nl*F.curl;

      var e2 = ss(w), m2 = 1-e2;
      var qx = m2*m2*sx + 2*m2*e2*cx2 + e2*e2*tx;
      var qy = m2*m2*sy + 2*m2*e2*cy2 + e2*e2*ty;

      var fop = Math.min(1,w/0.10) * (1 - ss(span(w,0.70,1)));
      var fax = qx*0.55 + qy*0.84, fbd = fax - BAND_C;
      var fsh = Math.exp(-(fbd*fbd)/(2*112*112));
      dust(qx, qy, Math.min(1, fop*(0.38 + 0.74*fsh)*(0.50 + 0.70*F.tb)), F.r*(1-0.30*e2));
    }

    /* flush the tiers: eight paths carry every mote on screen */
    for(bti=0;bti<TIERS;bti++){
      setA(S.tiers[bti], "d", BUCK[bti]);
      setA(S.tiers[bti], "opacity", BUCK[bti] ? (0.30 + (bti/(TIERS-1))*0.70).toFixed(3) : "0");
    }

    /* the bloom, on the brightest motes only */
    for(var bi=0; bi<N_BLOOM; bi++){
      var BW = WIND[(bi*13 + 5) % N_WIND], bc = S.blooms[bi];
      if(!BW || BW.op <= 0.05 || BW.sh <= 0.40){ setA(bc,"opacity","0"); continue; }
      setA(bc,"cx", BW.px.toFixed(2));
      setA(bc,"cy", BW.py.toFixed(2));
      setA(bc,"r", (2.0 + BW.r*5.0).toFixed(2));
      setA(bc,"opacity", (BW.sh * BW.op * 0.40).toFixed(3));
    }

    /* the sheen crosses the wordmark as it forms, then settles centred */
    var sheen = lerp(-118, 0, ss(span(t, T.letters[0], T.letters[1]+0.12)));
    setA(S.textGrad,"gradientTransform","translate("+sheen.toFixed(1)+" 0)");

    /* ---- the letters light as their gold arrives, centre outward ---- */
    for(var L=0;L<WORD_TEXT.length;L++){
      var d0 = T.letters[0] + Math.abs(L-4)*0.055;
      var lp = ss(span(t, d0, d0+0.30));
      setA(S.letters[L],"opacity", lp.toFixed(3));
      setA(S.letters[L],"transform",
        lp<0.999 ? "translate(0 "+lerp(2.6,0,lp).toFixed(2)+")" : "translate(0 0)");
    }
  }

  global.MaranathaOpening = {
    T:T, SPEED:SPEED, DURATION:T.total*SPEED, VB:VB, WORD_TEXT:WORD_TEXT,
    buildTable:buildTable, buildParticles:buildParticles,
    buildScene:buildScene, setLogo:setLogo, render:render
  };
})(window);
