// Ascend Web en Cloudflare (Worker con archivos estáticos, desplegado desde el repositorio ascend-datos):
// · /plaync/* y /buscar/*: proxy de solo lectura a la API oficial de AION 2 (que no deja llamarla desde un navegador).
// · Todo lo demás: la web (carpeta web/ del repositorio: la app compilada para navegador y sus datos del top).
// No guarda nada de los usuarios: solo una caché corta (30 s en perfiles, para que «Actualizar» vea los cambios
// de manastones o soul bind) para no repetir consultas iguales.

const DESTINOS = {
  plaync: { base: 'https://aion2.plaync.com', rutas: ['/api/character/info', '/api/character/equipment', '/api/character/equipment/item', '/api/character/daevanion/detail'], cache: 30 },
  buscar: { base: 'https://api-search.plaync.com', rutas: ['/aion2/search/v2/character', '/aion2global/search/v2/character'], cache: 120 },
};

async function proxy(req, ctx, d, ruta) {
  const url = new URL(req.url);
  const arriba = new URL(d.base + ruta);
  arriba.search = url.search;
  const clave = new Request(arriba.toString());
  const cache = caches.default;
  let r = await cache.match(clave);
  if (!r) {
    const resp = await fetch(arriba.toString(), {
      headers: { 'User-Agent': 'Ascend-Web/1.0', Accept: 'application/json', Referer: 'https://aion2.plaync.com/' },
    });
    r = new Response(resp.body, resp);
    r.headers.set('Cache-Control', `public, max-age=${d.cache}`);
    if (resp.ok) ctx.waitUntil(cache.put(clave, r.clone()));
  }
  return r;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const [, destino, ...resto] = url.pathname.split('/');
    const d = DESTINOS[destino];
    if (d) {
      if (req.method !== 'GET') return new Response('Solo GET', { status: 405 });
      const ruta = '/' + resto.join('/');
      if (!d.rutas.includes(ruta)) return new Response('Ruta no permitida', { status: 404 });
      return proxy(req, ctx, d, ruta);
    }
    return env.ASSETS.fetch(req);
  },
};
