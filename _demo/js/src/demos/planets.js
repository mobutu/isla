;
(function(exports) {
    var EnvStore, demoUtils, Isla;
    if (typeof module !== 'undefined' && module.exports) { // node
        EnvStore = require('../env-store.js').EnvStore;
        demoUtils = require('../demo-utils.js').demoUtils;
        Isla = require('../../node_modules/isla/src/isla.js').Isla;
    } else { // browser
        EnvStore = window.EnvStore;
        demoUtils = window.demoUtils;
        Isla = window.Isla;
    }

    function Planets(canvasCtx, demoTalker) {
        if (canvasCtx == null) {
            throw "You must provide a canvas context to draw to.";
        }

        if (demoTalker == null) {
            throw "You must provide a demo talker to communicate with.";
        }

        if (canvasCtx.fillRect === undefined) {
            throw "The variable you passed does not seem to be a canvas context.";
        }

        var _currentCtx;
        var currentCtx = function(inCtx) {
            if (inCtx !== undefined) {
                _currentCtx = inCtx;
                demoTalker.emit("demo:ctx:new", _currentCtx);
            } else {
                return _currentCtx;
            }
        };

        var _indications = {};
        this.indications = function(inIndications) {
            if (inIndications !== undefined) {
                _indications = inIndications;
            } else {
                return _indications;
            }
        };

        //////////////////////////////////////!!!!!!!!!!!!!!!!!!!!
        // add annotations in _meta to explain what attrs do



        ///////////////////////////////

        setupHelp(demoTalker, this);

        // main draw loop
        this._draw = function() {
            drawBackground(canvasCtx);
            if (currentCtx() !== undefined) { // no ctx until sent 1st one by runner
                currentCtx(move(currentCtx()));
                drawBodies(canvasCtx, currentCtx(), this.indications());
            }
        };

        var isThereAlreadyAStar = function() {
            var ctx = currentCtx();
            for (var i in ctx) {
                if (demoUtils.isIslaType(ctx[i], "star")) {
                    return true;
                }
            }
            return false;
        };

        // sets up cb to take latest Isla ctx, process planets and issue update
        demoTalker.on(this, "isla:ctx:new", function(ctx) {
            try {
                var gotStar = isThereAlreadyAStar();
                for (var i in ctx) {
                    if (demoUtils.isIslaType(ctx[i], "planet")) {
                        ctx[i] = planetDefaults(canvasCtx, ctx[i]);
                    } else if (demoUtils.isIslaType(ctx[i], "star")) {
                        ctx[i] = starDefaults(canvasCtx, ctx[i], gotStar);
                    }
                }
                currentCtx(ctx);
            } catch (e) {
                console.log(e.message);
                throw e;
            }
        });

        // set draw loop going
        var self = this;
        this.interval = setInterval(function() {
            self._draw();
        }, 33);
    }

    Planets.prototype = {
        getTutorSteps: function() {
            return STEPS;
        },
        // stop drawing
        end: function() {
            clearInterval(this.interval);
        },
        init: function() {
        },
        intro: function() {
            return [
                // "sun is a star",
                // "a is a planet",
                // "b is a planet",
                // "c is a planet"
            ];
        }
    };

    var pf = parseFloat;

    var drawBackground = function(canvasCtx) {
        canvasCtx.fillStyle = "#000";
        canvasCtx.fillRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
    };

    var drawBodies = function(canvasCtx, ctx, indications) {
        for (var i in ctx) {
            if (demoUtils.isIslaType(ctx[i], "planet") || demoUtils.isIslaType(ctx[i], "star")) {
                drawBody(canvasCtx, ctx[i], indications[i]);
            }
        }
    };

    // returns mass for object of density and radius
    var mass = function(density, radius) {
        return density * Math.pow(radius, 3) * Math.PI;
    };

    // returns the gravitational force between body1 and body2
    var gravitationalForce = function(body1, body2) {
        var m1 = mass(density(body1.density), size(body1.size) / 2);
        var m2 = mass(density(body2.density), size(body2.size) / 2);
        var r2 = Math.pow(demoUtils.absMax(body2._x - body1._x, 50), 2) +
                Math.pow(demoUtils.absMax(body2._y - body1._y, 50), 2);
        return (6.673e-11 * m1 * m2) / r2;
    };

    // returns the horizontal and vertical pull of body2 on body1
    var gravitationalVector = function(body1, body2) {
        var force = gravitationalForce(body1, body2);
        return {
            x: (body2._x - body1._x) * force,
            y: (body2._y - body1._y) * force
        };
    };

    var move = function(ctx) {
        // build list of gravitational pulls on bodies
        var m = [];
        for (var i in ctx) {
            for (var j in ctx) {
                if ((ctx[i] !== ctx[j] && demoUtils.isIslaType(ctx[i], "planet")) &&
                        (demoUtils.isIslaType(ctx[j], "planet") || demoUtils.isIslaType(ctx[j], "star"))) {
                    m.push({
                        bodyId: i,
                        vec: gravitationalVector(ctx[i], ctx[j])
                    })
                }
            }
        }

        // apply m to speed, and move
        for (var i = 0; i < m.length; i++) {
            var b = ctx[m[i].bodyId];

            b._xSpeed = (pf(b._xSpeed)) + m[i].vec.x;
            b._ySpeed = (pf(b._ySpeed)) + m[i].vec.y;

            b._x = pf(b._x) + pf(b._xSpeed);
            b._y = pf(b._y) + pf(b._ySpeed);
        }

        // to string all vals for Isla
        for (var i in ctx) {
            if (demoUtils.isIslaType(ctx[i], "planet")) {
                var b = ctx[i];
                b._xSpeed = b._xSpeed.toString();
                b._ySpeed = b._ySpeed.toString();
                b._x = b._x.toString();
                b._y = b._y.toString();
            }
        }

        return ctx;
    };

    var drawBody = function(canvasCtx, body, indicate) {
        var bodySize = size(body.size);
        canvasCtx.strokeStyle = demoUtils.color(body.color);
        canvasCtx.beginPath();
        canvasCtx.arc(body._x, body._y, bodySize / 2, 0, Math.PI * 2, true);
        canvasCtx.closePath();
        if (indicate === true) {
            canvasCtx.lineWidth = 4;
        } else {
            canvasCtx.lineWidth = 1;
        }

        canvasCtx.stroke();
    };

    var setupHelp = function(demoTalker, demo) {
        demoTalker.on(this, "isla:mouse:mouseover", function(data) {
            if (data.thing === "token" && data.syntaxNode.syntax === "variable") {
                var indications = Isla.Library.clone(demo.indications());
                indications[data.syntaxNode.code] = true;
                demo.indications(indications);
            }
        });

        demoTalker.on(this, "isla:mouse:mouseout", function() {
            demo.indications({});
        });
    };

    var clearHelp = function() {
        indicate("clear");
    };

    var indicate = function(event, data) {
        consoleIndicator.write({event: event, data: data, id: id});
    };

    var SIZES = {small: 20, medium: 30, big: 40, huge: 80};
    var DENSITIES = {low: 2, medium: 4, high: 6};

    var size = function(sizeStr) {
        return demoUtils.translateNumberWord(sizeStr, SIZES);
    };

    var density = function(densityStr) {
        return demoUtils.translateNumberWord(densityStr, DENSITIES);
    };

    // don't spawn too near to, or far from, the centre
    var getRandomBodyCoords = function(canvasCtx) {
        return {
            x: demoUtils.plusMinus(canvasCtx.canvas.width / 8 +
                    demoUtils.random(canvasCtx.canvas.width / 6)) +
                    canvasCtx.canvas.width / 2,
            y: demoUtils.plusMinus(canvasCtx.canvas.height / 8 +
                    demoUtils.random(canvasCtx.canvas.height / 6)) +
                    canvasCtx.canvas.height / 2
        };
    };

    var planetDefaults = function(canvasCtx, planet) {
        var retPlanet = planet;
        retPlanet.size = retPlanet.size ||
                demoUtils.random(demoUtils.edit(SIZES, ["huge"]));
        retPlanet.color = retPlanet.color ||
                demoUtils.random(demoUtils.edit(demoUtils.COLORS, ["yellow"]));
        retPlanet.density = retPlanet.density || demoUtils.random(DENSITIES);
        retPlanet._xSpeed = retPlanet._xSpeed || demoUtils.random(0.2) - 0.1;
        retPlanet._ySpeed = retPlanet._ySpeed || demoUtils.random(0.2) - 0.1;

        if (retPlanet._x === undefined) {
            var coords = getRandomBodyCoords(canvasCtx);
            retPlanet._x = coords.x;
            retPlanet._y = coords.y;
        }
        return retPlanet;
    };

    var starDefaults = function(canvasCtx, star, gotStar) {
        var retStar = star;
        retStar.size = retStar.size || "huge";
        retStar.color = retStar.color || "yellow";
        retStar.density = retStar.density || 'high';

        if (gotStar) {
            var coords = getRandomBodyCoords(canvasCtx);
            retStar._x = retStar._x || coords.x;
            retStar._y = retStar._y || coords.y;
        } else {
            retStar._x = retStar._x || canvasCtx.canvas.width / 2;
            retStar._y = retStar._y || canvasCtx.canvas.height / 2;
        }
        return retStar;
    };

    var STEPS = [
        "sun is a star",
        "mars is a planet",
        "mars color is 'red'",
        "mars size is 'medium'",
        "jupiter is a planet",
        "jupiter color is 'orange'",
        "jupiter size is 'big'"
    ];

    exports.Planets = Planets;
})(typeof exports === 'undefined' ? this : exports)
