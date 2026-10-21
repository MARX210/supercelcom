import './style.css'

const IMGS=["/images/produto-0.jpg", "/images/produto-1.jpg", "/images/produto-2.jpg", "", "/images/produto-4.jpg", "/images/produto-5.jpg", "/images/produto-6.jpg", "/images/produto-7.jpg"];
const $=s=>document.querySelector(s),rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('img[data-i]').forEach(i=>i.src=IMGS[i.dataset.i]);

/* menu */
const nav=$('#nav'),bg=$('#burger');
const setOpen=o=>{nav.classList.toggle('open',o);bg.setAttribute('aria-expanded',o)};
bg.onclick=e=>{e.stopPropagation();setOpen(!nav.classList.contains('open'))};
document.addEventListener('click',e=>{if(!nav.contains(e.target)||e.target.closest('.menu a'))setOpen(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);bg.focus()}});

/* anel 3D: câmera no centro do cilindro, então cada card encara a câmera.
   posição = (R·sen a, 0, R·(1−cos a)), giro = −a. Perspectiva = R. */
const ring=$('#ring'),rw=$('#rw'),ORDER=[5,1,4,2,0,7],N=21,STEP=360/N,CULL=64,cards=[];
for(let i=0;i<N;i++){const c=document.createElement('div');c.className='card';const im=new Image();im.alt='';im.src=IMGS[ORDER[i%ORDER.length]];c.appendChild(im);ring.appendChild(c);cards.push(c)}
let R=560,phase=-2,vx=0,cw=140;
function size(){cw=Math.max(116,Math.min(170,innerWidth*.34));rw.style.setProperty('--cw',cw+'px');R=cw*4;
 const ch=cw*1.28;ring.style.height=ch+'px';ring.style.perspective=R+'px';ring.style.perspectiveOrigin='50% '+(ch*.5+ch*1.7)+'px';
 rw.style.minHeight=(ch+90)+'px'}
function place(){cards.forEach((el,i)=>{const a=((i*STEP+phase)%360+540)%360-180;
 if(Math.abs(a)>CULL){el.style.visibility='hidden';return}
 el.style.visibility='visible';const r=a*Math.PI/180,c=Math.cos(r);
 el.style.transform=`translate3d(${R*Math.sin(r)}px,0,${R*(1-c)}px) rotateY(${-a}deg)`;
 el.style.filter=`brightness(${.84+.5*(1/c-1)})`})}
size();place();addEventListener('resize',()=>{size();place()});

/* parallax: mouse (desktop) + scroll (mobile) com suavização */
const hero=$('#hero'),photo=$('#photo');let tx=0,ty=0,cx=0,cy=0,last=performance.now();
addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;tx=(e.clientX/innerWidth-.5)*2;ty=(e.clientY/innerHeight-.5)*2},{passive:true});
function tick(t){const dt=Math.min((t-last)/1000,.1);last=t;
 if(!rm){cx+=(tx-cx)*.08;cy+=(ty-cy)*.08;const sy=Math.min(scrollY,900);
  hero.style.setProperty('--px',cx.toFixed(3));hero.style.setProperty('--py',cy.toFixed(3));hero.style.setProperty('--sy',sy);
  const pr=photo.getBoundingClientRect();photo.style.setProperty('--py',(pr.top/innerHeight-.5).toFixed(3));photo.style.setProperty('--px',cx.toFixed(3));
  phase-=(1.9+cx*4)*dt;place()}
 requestAnimationFrame(tick)}
document.addEventListener('visibilitychange',()=>last=performance.now());
requestAnimationFrame(tick);

/* inclinação 3D dos cards de serviço */
if(matchMedia('(hover:hover)').matches&&!rm)document.querySelectorAll('.t').forEach(t=>{
 t.addEventListener('pointermove',e=>{const b=t.getBoundingClientRect(),x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;
  t.style.setProperty('--ry',(x*7)+'deg');t.style.setProperty('--rx',(-y*7)+'deg');t.style.setProperty('--mx',x);t.style.setProperty('--my',y)});
 t.addEventListener('pointerleave',()=>['--rx','--ry','--mx','--my'].forEach(v=>t.style.setProperty(v,v[1]==='r'?'0deg':0)))});

/* horário de funcionamento (fuso de Brasília) */
(function(){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(new Date()),g=k=>p.find(x=>x.type===k).value;
 const d=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(g('weekday')),m=+g('hour')*60+ +g('minute');
 const end=d===0?0:d===6?13*60:18*60,open=d!==0&&m>=540&&m<end,s=$('#status');
 s.textContent=open?'Aberta agora, fecha às '+(end/60)+':00':'Fechada agora';s.classList.toggle('on',open);
 const row=d===0?0:d===6?6:1;document.querySelector('[data-d="'+row+'"]').classList.add('today')})();

/* ---------- Liquid Glass: brilho que segue o toque/mouse + refração (Chromium) ---------- */
(() => {
  nav.addEventListener('pointermove', e => {
    const r = nav.getBoundingClientRect();
    nav.style.setProperty('--lx', (e.clientX - r.left) + 'px');
    nav.style.setProperty('--ly', (e.clientY - r.top) + 'px');
  });
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });

  // mapa de deslocamento: as bordas "dobram" o que está atrás, o centro fica limpo
  if (/Chrome\//.test(navigator.userAgent) && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const map = document.getElementById('lgmap');
    const build = () => {
      const w = Math.round(nav.offsetWidth), h = Math.round(nav.offsetHeight), rx = h / 2, m = 12;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <defs><linearGradient id="x" x1="0" x2="1"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#000"/></linearGradient>
        <linearGradient id="y" y1="0" y2="1"><stop offset="0" stop-color="#0f0"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
        <rect width="${w}" height="${h}" fill="#808080"/>
        <rect width="${w}" height="${h}" rx="${rx}" fill="url(#x)"/>
        <rect width="${w}" height="${h}" rx="${rx}" fill="url(#y)" style="mix-blend-mode:difference"/>
        <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="${rx - m}" fill="#808080" style="filter:blur(8px)"/></svg>`;
      map.setAttribute('href', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    };
    build(); nav.classList.add('refract');
    addEventListener('resize', build);
  }
})();

/* ---------- vídeo de fundo do hero: repete sempre; no fim segura a logo e dissolve para o começo ---------- */
(() => {
  const v = document.getElementById('hv');
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saver = navigator.connection && navigator.connection.saveData;
  if (!v || rm || saver) return;
  const box = v.parentElement;
  const k = matchMedia('(max-width: 859px)').matches ? 'm' : 'd';
  const start = `url(/video/hero-${k}-start.jpg)`;
  new Image().src = `/video/hero-${k}-start.jpg`;
  v.src = v.canPlayType('video/mp4; codecs="avc1.42E01E"') ? v.dataset[k + 'Mp4'] : v.dataset[k + 'Webm'];

  const fadeIn = () => v.classList.add('on');
  v.addEventListener('playing', fadeIn);
  box.style.setProperty('--vp', start);          // enquanto carrega, mostra o primeiro frame
  v.play().catch(() => { v.remove(); box.style.removeProperty('--vp'); });   // sem autoplay: fica a logo montada

  let timer;
  v.addEventListener('ended', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {                    // segura a logo ~2s e dissolve para o frame inicial
      v.classList.remove('on');
      timer = setTimeout(() => { v.currentTime = 0; v.play().catch(() => {}); }, 900);
    }, 2000);
  });
  document.addEventListener('visibilitychange', () => {
    if (v.ended || !v.parentNode) return;
    document.hidden ? v.pause() : v.play().catch(() => {});
  });
})();

/* ---------- pop-up com mais informações de cada serviço ---------- */
(() => {
  const WA = 'https://wa.me/554626010325?text=';
  const INFO = {
    iphone: {
      p: 'Temos iPhones novos e seminovos. Os modelos e as cores mudam conforme o estoque, então a forma mais rápida de ver tudo o que está disponível hoje é chamar a gente no WhatsApp.',
      h: 'O que você encontra', l: ['Vários modelos e cores, conforme a disponibilidade', 'Aparelhos originais e com garantia', 'Parcelamento em até 21x no cartão', 'Dúvidas sobre estado, bateria e armazenamento tiradas antes de você decidir'],
      cta: 'Quero ver todas as opções disponíveis', msg: 'Olá! Vim pelo site da Super Cell e quero ver todas as opções de iPhones novos e seminovos disponíveis.'
    },
    virus: {
      p: 'Celular lento, travando ou abrindo anúncios sozinho? Pode ser vírus ou um aplicativo malicioso. Na assistência técnica da Super Cell a gente verifica o aparelho e faz a limpeza.',
      h: 'Sinais mais comuns', l: ['Lentidão e travamentos fora do normal', 'Anúncios e pop-ups aparecendo sozinhos', 'Aplicativos que você não lembra de ter instalado', 'Bateria acabando mais rápido que antes'],
      cta: 'Pedir orçamento no WhatsApp', msg: 'Olá! Vim pelo site da Super Cell. Meu celular está lento/com anúncios aparecendo sozinhos e quero um orçamento para remoção de vírus.'
    },
    pc: {
      p: 'Notebook ou computador demorando para ligar, lento ou travando no meio do trabalho? A gente faz limpeza, atualização e ajuste para ele voltar a rodar leve.',
      h: 'O que a gente faz', l: ['Avaliação do que está causando a lentidão', 'Limpeza e organização do sistema', 'Atualização de programas e do sistema', 'Ajustes para melhorar o desempenho'],
      cta: 'Falar com a assistência', msg: 'Olá! Vim pelo site da Super Cell. Meu computador está lento/travando e queria um orçamento.'
    },
    peliculas: {
      p: 'Proteção para o aparelho que você já tem. Consulte as películas e os acessórios disponíveis para o seu modelo.',
      h: 'Como pedir', l: ['Mande o modelo do seu celular', 'Veja o que temos para ele na hora', 'Retire na loja, no Centro de Francisco Beltrão'],
      cta: 'Consultar para o meu celular', msg: 'Olá! Vim pelo site da Super Cell. Quero consultar películas e acessórios para o meu celular. O modelo é: '
    },
    watch: {
      p: 'Opções para acompanhar o seu dia: smartwatches e outros eletrônicos. A linha muda conforme o estoque, então consulte o que está disponível.',
      h: 'Vantagens', l: ['Produtos com garantia de qualidade', 'Parcelamento em até 21x no cartão', 'Atendimento direto com a equipe da loja'],
      cta: 'Ver o que tem disponível', msg: 'Olá! Vim pelo site da Super Cell e quero ver os smartwatches e eletrônicos disponíveis.'
    },
    xiaomi: {
      p: 'Smartphones Xiaomi novos, originais e com garantia. Chame a gente para saber quais modelos estão disponíveis agora.',
      h: 'Vantagens', l: ['Modelos novos e originais', 'Garantia de qualidade', 'Parcelamento em até 21x no cartão'],
      cta: 'Quero saber os modelos', msg: 'Olá! Vim pelo site da Super Cell e quero saber quais modelos Xiaomi novos estão disponíveis.'
    }
  };
  const dlg = $('#dlg'), root = document.documentElement;
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const open = t => {
    const d = INFO[t.dataset.k]; if (!d) return;
    const im = t.querySelector('img');
    $('#dimg').src = im.src; $('#dimg').alt = im.alt;
    $('#dt').textContent = t.querySelector('h3').textContent;
    $('#dp').textContent = d.p; $('#dh').textContent = d.h;
    $('#dl').replaceChildren(...d.l.map(x => Object.assign(document.createElement('li'), { textContent: x })));
    $('#dcta').textContent = d.cta; $('#dwa').href = WA + encodeURIComponent(d.msg);
    $('.sheet-in').scrollTop = 0;
    root.classList.add('lock'); dlg.showModal();
  };
  document.querySelectorAll('.t[data-k]').forEach(t => {
    t.addEventListener('click', () => open(t));
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(t) } });
  });
  $('#dx').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close() });   // toque fora fecha
  dlg.addEventListener('close', () => root.classList.remove('lock'));
})();
