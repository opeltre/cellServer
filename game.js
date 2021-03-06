/* game.js 

    Cell = (String, Int) 

    State = Vertex > Cell

    Moves = Edge > Cell 
*/ 

let graph = require('./graph'),
    __ = require('lolo'),
    _r = __.r;

module.exports = Game;

Game.lattice = size => 
    Game(graph.lattice(...size));

//------ Cell Operations ------
    
//  Cell = (String, Int) 

//  getPlayer : Cell -> String
let getPlayer = ([p, w]) => p;

//  getWeight : Cell -> Int
let getWeight = ([p, w]) => w;

//  setWeight : Int -> Cell -> Int
let setWeight = w1 => ([p, w0]) => [p, w1]; 

//  isVitamin : Cell -> Bool
let isVitamin = c => getPlayer(c) === '*'; 

//  newVitamin : Int -> Cell
let newVitamin = w => ['*', w];

//  newCell : (String, Int) -> Cell
let newCell = (p, w) => [p, w];


//------ Record Operations ------

/*  Pluck subrecords satisfying a common grouping property */ 
 
//  groupBy : (a -> b) -> {a} -> (b > {a})  
let groupBy = key => elems => {
    let groups = {}; 
    _r.forEach((ei, i) => {
        let k = key(ei, i),
            gk = groups[k]
        if (!gk)
            gk = {}
        gk[i] = ei;
        groups[k] = gk;
    })(elems);  
    return groups;
};

/*  Concatenate a record of subrecords */ 

//  degroup : (b > {a}) -> {a} 
let degroup = groups => 
    _r.reduce(
        (elems, group) => _r.assign(group)(elems),
        {}
    )(groups);

/*  Randomly select one of a record's keys */

//  randKey : {a} -> String
let randKey = as => {
    let ks = Object.keys(as); 
    return ks.length > 1
        ? ks[Math.floor(Math.random() * ks.length)]
        : ks[0];
}; 

/*  Randomly select N elements in an array */

//  randElements : Int -> [a] -> [a] 
let randElements = N => as => {
    if (N === 0) 
        return [];
    let i = Math.floor(Math.random() * as.length);
    return [as[i], ...randElements(N-1)([
        ...as.slice(0, i), 
        ...as.slice(i+1, as.length)
    ])];
};

/*  Map function on record - acting in place */

//  rmap : (a -> b) -> {a} -> St({a}, {b})
let rmap = f => (as) => {
    Object.keys(as).forEach(k => {
        as[k] = f(as[k], k);
    });
    return as;
}

//------ Merging Cells ------ 

/*  Assign the total weight of a group to one of the heaviest cells. */

//  mergeGroup : {Cell} -> {Cell} 
let mergeGroup = cells => {
    if (_r.keys(cells).length === 1) 
        return cells;
    let [maxWeight, totalWeight] = _r.reduce(
        ([max, tot], cell) => {
            let w = getWeight(cell);
            return [w > max ? w : max, tot + w];
        },
        [0, 0]
    )(cells);
    let winner = __.pipe(
        _r.filter(c => getWeight(c) === maxWeight && !isVitamin(c)),
        randKey
    )(cells); 
    return rmap(
        (c, key) => setWeight(key === winner ? totalWeight : 0)(c)
    )(cells);
}; 

/*  Merge cells by player before merging the whole group. */

//  merge : {Cell} -> {Cell} 
let merge = __.pipe(
    groupBy(getPlayer), 
    rmap(mergeGroup),
    degroup, 
    mergeGroup
);

/*  Merge only cells satisfying a common property 

        groupBy(f)       _r.map(merge)       degroup
    {a} ---------> {{a}} ------------> {{a}} ------> {a} 
      `                                               ^              
        ` - - - - - - - - - - - - - - - - - - - - - - '
                         mergeBy(f) 
*/

//  mergeBy : (Cell -> String) -> {Cell} -> {Cell} 
let mergeBy = property => __.pipe(
    groupBy(property),
    rmap(merge),
    degroup,
); 


//====== Game Operations ======

function Game (graph) {

    let my = {}; 

    //------ Merging Cells ------ 

    /* Merge cells crossing the same edge */

    //.crossing : (Edge > Cell) -> (Edge > Cell) 
    my.crossing = mergeBy((c, e) => graph.edgeSym(e)); 

    /* Merge cells reaching the same node */

    //.reaching : (Edge > Cell) -> (Edge > Cell) 
    my.reaching = mergeBy((c, e) => graph.edgeTarget(e));

    /* Return successive weights of cells running through edges */

    //.transition : (Edge > Cell) -> (Edge > (Player, [Int]))
    my.transition = move => {
        let m1 = my.crossing(move),
            m2 = my.reaching(m1); 
        return _r.map(
            (cell, edge) => [getPlayer(cell), [
                getWeight(cell),
                getWeight(m1[edge]),
                getWeight(m2[edge])
            ]]
        )(move);
    };

    /* Compute the final state from transitions */ 

    //.final : (Edge > (Player, [Int])) -> (Vertex > Cell)
    my.final = __.pipe(
        _r.filter(([p, ws]) => ws[2] > 0),
        _r.map(([p, ws]) => newCell(p, ws[2])),
        _r.reduce(
            (state, c, e) => _r.set(graph.edgeTarget(e), c)(state),
            {}
        )
    );


    //------ Dividing Cells ------

    /*  Allow child cells to move as long as mother has enough weight */

    //  acceptMoves : (Cell, Vertex) -> (Edge > Cell) -> (Edge > Cell)
    let acceptMoves = (cell, pos) => children => {

        if (_r.isEmpty(children)) 
            return getWeight(cell) !== 0
                ? _r.set(graph.vertexEdge(pos), cell)({})
                : {};

        let popped = _r.keys(children)[0],
            child = children[popped];
        children = _r.without(popped)(children);

        let [W, wi] = [cell, child].map(getWeight),
            [P, pi] = [cell, child].map(getPlayer);

        return wi <= W && pi === P 
            ? _r.set(popped, child)(
                acceptMoves(setWeight(W - wi)(cell), pos)(children)
            )
            : acceptMoves(cell, pos)(children);
    }

    /* Legalise moves w.r.t. given state and graph structure */

    //.legalise : (Vertex > Cell) -> (Edge > Cell) -> (Edge > Cell)
    my.legalise = state => moves => 
        __.pipe(
            _r.filter((c, e) => graph.isEdge(e) 
                && !(graph.edgeSource(e) === graph.edgeTarget(e))
            ),
            groupBy((c, e) => graph.edgeSource(e)),
            groups => _r.assign(groups)(_r.map(() => ({}))(state)),
            rmap((cs, v) => state[v] ? acceptMoves(state[v], v)(cs) : {}),
            degroup
        )(moves); 


    //------ Spawn Vitamins ------ 
    
    //.addVitamins : Int -> (Vertex > Cell) -> (Vertex > Cell)
    my.addVitamins = n => state => {
        let free = graph.getVertices()
            .filter(v => !state[v]);
        let nVit = Math.min(n, free.length),
            positions = randElements(nVit)(free),
            vits = _r.compute(pos => newVitamin(1))(positions);
        return _r.assign(vits)(state);
    };
    
    //.countVitamins : (Vertex > Cell) -> Int
    my.countVitamins = state => __.pipe(
        _r.filter(isVitamin),
        _r.keys,
        ks => ks.length
    )(state);

    
    //------ Spawn Players ------

    //.addPlayers : ([String], Int) -> (Vertex > Cell) -> (Vertex > Cell)
    my.addPlayers = (players, w0) => state => {
        graph.initialVertices(players.length)
            .forEach((vi, i) => {
                state[vi] = newCell(players[i], w0)
            });
        return state;
    };


    //------ Initial State ------ 
    
    //.newState : ([String], Int, Int) -> (Vertex > Cell)
    my.newState = (ps, w0, nVit) => __.pipe(
        my.addPlayers(ps, w0),
        my.addVitamins(nVit)
    )({});


    //------ Process Moves ------ 

    //.process : Int -> (State, Move) -> (State, Transition)
    my.process = NVit => (s0, m0) => {
        let m1 = my.legalise(s0)(m0),
            tr = my.transition(m1),
            s1 = my.final(tr),
            nVit = my.countVitamins(s1),
            dVit = NVit - nVit,
            s2 = my.addVitamins(dVit)(s1);
        return [s2, tr];
    };

    return my;
}

