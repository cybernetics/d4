/* global d3: false */

/*
  Functions "each", "extend", and "isFunction" based on Underscore.js 1.5.2
  http://underscorejs.org
  (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
  Underscore may be freely distributed under the MIT license.

  API:
  var columnChart = d4.columnChart()
    .margin({
      top: 15,
      right: 10,
      bottom: 30,
      left: 0
    })
    .mixin({
      'grid': d4.features.grid
    }, 0)
    .using('bars', function(bars){
      bars
      .x(function(d){
        cumulativeX += d[0];
        return this.x(cumulativeX - d[0]);
      })
      .width(function(d){
        return this.x(d[0]);
      })
    })

  d3.select(e[0])
    .datum(preparedValues)
    .call(columnChart);
*/
(function() {
  'use strict';

  var root = this;
  var breaker = {};

  // Create a safe reference to the d4 object.
  var d4 = function(obj) {
    if (obj instanceof d4) {
      return obj;
    }
    if (!(this instanceof d4)) {
      return new d4(obj);
    }
    this.d4Wrapped = obj;
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = d4;
    }
    exports.d4 = d4;
  } else {
    root.d4 = d4;
  }

  d4.features = {};
  d4.parsers = {};

  var each = d4.each = d4.forEach = function(obj, iterator, context) {
    var nativeForEach = Array.prototype.forEach,
      i, len;
    if (obj === null) {
      return;
    }
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (i = 0, len = obj.length; i < len; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) {
          return;
        }
      }
    } else {
      var keys = d3.keys(obj);
      for (i = 0, len = keys.length; i < len; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) {
          return;
        }
      }
    }
  };

  var isFunction = function(obj) {
    return !!(obj && obj.constructor && obj.call && obj.apply);
  };

  var isNotFunction = function(obj) {
    return !isFunction(obj);
  };

  var assert = function(message) {
    throw new Error('[d4] ' + message);
  };

  var validateBuilder = function(builder) {
    each(['configure', 'render'], function(funct) {
      if (!builder[funct] || isNotFunction(builder[funct])) {
        assert('The supplied builder does not have a ' + funct + ' function');
      }
    });
    return builder;
  };

  var assignDefaultBuilder = function(defaultBuilder) {
    if (!this.builder) {
      this.builder = validateBuilder(defaultBuilder.bind(this)());
    }
    return this;
  };

  var assignDefaults = function(config, defaultBuilder) {
    if (!defaultBuilder) {
      assert('No builder defined');
    }
    var opts = d4.merge({
      width: 400,
      height: 400,
      features: {},
      mixins: [],
      xKey: 'x',
      yKey: 'y',
      valueKey: 'y',
      margin: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 40
      }
    }, config);
    assignDefaultBuilder.bind(opts)(defaultBuilder);
    opts.accessors = ['margin', 'width', 'height', 'x', 'y', 'xKey', 'yKey', 'valueKey'].concat(config.accessors || []);
    return opts;
  };

  var build = function(data) {
    if (this.builder) {
      this.builder.configure(data);
      this.builder.render(data);
    } else {
      assert('No builder defined');
    }
  };

  var scaffoldChart = function(selection, data) {
    this.svg = d3.select(selection).selectAll('svg').data([data]);
    this.featuresGroup = this.svg.enter().append('svg').append('g')
      .attr('class', 'featuresGroup')
      .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
    this.svg.attr('width', this.width).attr('height', this.height).attr('class', 'd4');
    this.svg.append('defs');
  };

  var applyScaffold = function(opts) {
    return function(selection) {
      selection.each(function(data) {
        scaffoldChart.bind(opts, this)(data);
        build.bind(opts)(data);
      });
    };
  };

  var extractOverrides = function(feature) {
    if (feature.overrides) {
      return feature.overrides(this);
    } else {
      return {};
    }
  };

  // Specify the feature to mixin.
  // `index` is optional and will place a mixin at a specific 'layer.'
  d4.mixin = function(feature, index) {
    if (!feature) {
      assert('You need to supply an object to mixin.');
    }
    var name = d3.keys(feature)[0];
    var overrides = extractOverrides.bind(this)(feature, name);
    feature[name] = d4.merge(feature[name](name), overrides);
    d4.extend(this.features, feature);
    if (typeof index !== 'undefined') {
      index = Math.max(Math.min(index, this.mixins.length), 0);
      this.mixins.splice(index, 0, name);
    } else {
      this.mixins.push(name);
    }

    /*
      FIXME: see fixme note related to the chart accessor functions, the same
    problem applies here.
    */
    var accessors = this.features[name].accessors;
    if (accessors) {
      d3.keys(accessors).forEach(function(functName) {
        this.features[name][functName] = function(attr) {
          if (!arguments.length) {
            return this.features[name].accessors[functName];
          }
          this.features[name].accessors[functName] = attr;
          return this.features[name];
        }.bind(this);
      }, this);
    }
  };

  d4.mixout = function(name) {
    if (!name) {
      assert('A name is required in order to mixout a chart feature.');
    }

    delete this.features[name];
    this.mixins = this.mixins.filter(function(val) {
      return val !== name;
    });
  };

  d4.using = function(name, funct) {
    var feature = this.features[name];
    if (isNotFunction(funct)) {
      assert('You must supply a continuation function in order to use a chart feature.');
    }
    if (!feature) {
      assert('Could not find feature: "' + name + '", maybe you forgot to mix it in?');
    } else {
      funct.bind(this)(feature);
    }
  };

  d4.baseChart = function(config, defaultBuilder) {
    var opts = assignDefaults(config, defaultBuilder);
    var chart = applyScaffold(opts);

    /*
      FIXME: d4 wraps the inner property object `opts` in a series of class
    functions. For example: `chart.width(300)` will set the internal
    `opts.width` property to 300. Additionally chart.width() will return 300.
    However, this behavior creates ambiguity in API because it is unclear to the
    developer which accessors require functions and which can simply supply
    values. Ideally the API should support something like this:
    chart.xKey('foo') or chart.xKey(function(){ return 'foo'; })
    Presently only the latter is allowed, which is confusing.
    */
    chart.accessors = opts.accessors;
    chart.accessors.forEach(function(accessor) {
      chart[accessor] = function(attr) {
        if (!arguments.length) {
          return opts[accessor];
        }
        opts[accessor] = attr;
        return chart;
      };
    });

    chart.using = function(name, funct) {
      d4.using.bind(opts)(name, funct);
      return chart;
    };

    chart.mixin = function(feature, index) {
      d4.mixin.bind(opts)(feature, index);
      return chart;
    };

    chart.mixout = function(feature, index) {
      d4.mixout.bind(opts)(feature, index);
      return chart;
    };

    chart.builder = function(funct) {
      validateBuilder(funct.bind(chart)(opts));
      return chart;
    };

    chart.features = function() {
      return opts.mixins;
    };

    return chart;
  };

  d4.merge = function(options, overrides) {
    return d4.extend(d4.extend({}, options), overrides);
  };

  d4.extend = function(obj) {
    each(Array.prototype.slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (source[prop] && source[prop].constructor &&
            source[prop].constructor === Object) {
            obj[prop] = obj[prop] || {};
            d4.extend(obj[prop], source[prop]);
          } else {
            obj[prop] = source[prop];
          }
        }
      }
    });
    return obj;
  };

}).call(this);
