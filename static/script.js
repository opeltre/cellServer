let room = null,
    settings = {},
    players = [],
    colormap = {'*': [0, 255, 0]},
    playerColors = [
        [255, 0, 2],
        [0, 0, 255]
    ];

let socket = io()
    .on('msg', console.log)
    .on('settings', stgs => settings = stgs)
    .on('players', getPlayers)
    .on('rooms', showRooms)
    .on('transition', viewTransition);

//------ Navigation ------

function getRooms () {
    socket.emit('getRooms');
}

function joinRoom (name) {
    socket.emit('viewRoom', name),
    transitions = [];
}

function showRooms (rooms) {
    let oldDiv = document.getElementById('games');
    let newDiv = 
        dom('#games')
            .pull(__.r.toPairs)
            .branch(games => games.map(
                ([r, name]) => dom.pull(() => ({name, ...r}))(room)
            ));
    let room = 
        dom('.game', {
            onclick: (e, io, r) => joinRoom(r.name)
        }, [
            ['span.name',       {html: r => r.name}],
            ['span.nPlayers',   {html: r => `(${r.nPlayers})`}],
            ['span.players',    {html: r => `${r.players.join('\t')}`}]
        ]);
    oldDiv.replaceWith(newDiv(rooms));
}


//------ Player Colors ------

function getPlayers (ps) {
    players = ps;
    players.forEach((p, i) => {
        colormap[p] = playerColors[i]
    });
}


//------ Game View ------ 

let svg = dom('svg', {width: "600px", height: "600px"})
    .branch([dom('g#transition').place('gCells')])
    .put('#view');

let ioCells = dom.IO.put(svg)();

function viewTransition (trs) {

    let [X, Y] = settings.size,
        [W, H] = [600, 600],
        [w, h] = [W/X, H/Y],
        fps = 20,
        ds = 1/fps,
        T = settings.delay/1000;

    //  interpolate : (Edge, Num) -> (Int, Int)
    let interpolate = (edge, k) => {
        let [[x0, y0], [x1, y1]] = edge
            .split(' > ').map(v => v.split(':').map(n => +n));
        return [(1-k)*x0 + k*x1, (1-k)*y0 + k*y1];
    }
   
    //  interweight : ([Int], Num) -> Num
    let interweight = (ws, k) => k <= .5 
        ? 2 * k * ws[1] + (1 - 2 * k) * ws[0]
        : 2 * (k - .5) * ws[2] + (2 - 2 * k) * ws[1];

    //  model : Num -> [CellModel]
    let model = k => __.pipe(
        _r.map(([p, ws], edge) => ({
            player: p,
            weight: interweight(ws, k), 
            pos: interpolate(edge, k).map(coord => coord * w)
        })),
        _r.toPairs, 
        __.map(([m, e]) => m)
    )(trs); 

    let color = () => "#f23";

    //  cell : CellModel -> Dom
    let cell = dom('rect.cell', {
        fill        : m => `rgb(${colormap[m.player].join(',')})`,
        'fill-opacity': m => Math.min(m.weight/10, 1),
        width       : w,
        height      : h,
        transform: m => `translate(${m.pos[0]}, ${m.pos[1]})`
    })
        .place('cell')

    //  cells : [CellModel] -> Dom
    let cells = dom.map(cell)
        .pull(model)
    
    //  group : [CellModel] -> Dom
    let group = dom('g#transition')
        .place('gCells')
        .put('svg')
        .branch(cells);

    //  tick : Num -> IO(Num)
    let tick = k => dom.IO()
        .return(k)
        .bind(dom.IO.map.set(cells))
        .return(k + ds / T);
    
    //  loop : Num -> IO()
    let loop = k => k < 1 - ds / T
        ? tick(k).sleep(1/fps).bind(loop)
        : tick(k);
    
    ioCells.return(0)
        .bind(dom.IO.replace(group))
        .sleep(ds)
        .return(ds / T)
        .bind(loop);

}
