define(function(require, exports, module) {

var ast = require('ast'),
    Node = ast.Node;

if (!Function.prototype.curry) {
  Function.prototype.curry = function () {
    var fn = this, args = Array.prototype.slice.call(arguments);
    return function () {
      return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
    };
  };
}

function normalizeArgs(args) {
  if(args.length === 1 && args[0].apply) { // basic, one function, shortcut!
    return args[0];
  }
  args = Array.prototype.slice.call(args, 0);
  if(args[0] && Object.prototype.toString.call(args[0]) === '[object Array]') {
    args = args[0];
  }
  return function() {
    var result;
    for(var i = 0; i < args.length; i++) {
      if(typeof args[i] === 'string') {
        var parsedPattern = ast.parse(args[i]);
        var bindings = parsedPattern.match(this);
        if(bindings) {
          if(args[i+1] && args[i+1].apply) {
            result = args[i+1].call(this, bindings);
            i++;
          } else {
            result = this;
          }
          if(result) {
            return result;
          }
        } else if(args[i+1] && args[i+1].apply) {
          i++;
        }
      } else if(args[i].apply) {
        result = args[i].call(this);
        if(result) {
          return result;
        }
      } else {
        throw Error("Invalid argument: ", args[i]);
      }
    }
    return false;
  };
}

function all(fn) {
  var result, i;
  fn = normalizeArgs(arguments);
  if(this instanceof ast.ConsNode) {
    for (i = 0; i < this.length; i++) {
      result = fn.call(this[i]);
      if (!result) {
        return false;
      }
    }
  } else if(this instanceof ast.ListNode) {
    for (i = 0; i < this.length; i++) {
      result = fn.call(this[i]);
      if (!result) {
        return false;
      }
    }
  }
  return this;
}

function one(fn) {
  var result, i, oneSucceeded;
  fn = normalizeArgs(arguments);

  if(this instanceof ast.ConsNode) {
    oneSucceeded = false;
    for (i = 0; i < this.length; i++) {
      result = fn.call(this[i]);
      if (result) {
        oneSucceeded = true;
      }
    }
    if(!oneSucceeded) {
      return false;
    }
  } else if(this instanceof ast.ListNode) {
    oneSucceeded = false;
    for (i = 0; i < this.length; i++) {
      result = fn.call(this[i]);
      if (result) {
        oneSucceeded = true;
      }
    }
    if (!oneSucceeded) {
      return false;
    }
  }
  return this;
}

/**
 * Sequential application last argument is term
 */
function seq() {
  var fn;
  var t = this;
  for ( var i = 0; i < arguments.length; i++) {
    fn = arguments[i];
    t = fn.call(t);
    if (!t) {
      return false;
    }
  }
  return this;
}

/**
 * Left-choice (<+) application
 */
function leftChoice() {
  var t = this;
  var fn, result;
  for ( var i = 0; i < arguments.length; i++) {
    fn = arguments[i];
    result = fn.call(t);
    if (result) {
      return result;
    }
  }
  return false;
}

// Try
exports.attempt = function(fn) {
  fn = normalizeArgs(arguments);
  var result = fn.call(this);
  return !result ? this : result;
};

exports.debug = function(pretty) {
  console.log(pretty ? this.toPrettyString("") : this.toString());
  return this;
};

exports.traverseTopDown = function(fn) {
  fn = normalizeArgs(arguments);
  exports.rewrite.call(this, fn, all.curry(exports.traverseTopDown.curry(fn)));
  return this;
};

exports.collectTopDown = function(fn) {
  fn = normalizeArgs(arguments);
  var results = [];
  this.traverseTopDown(function() {
      var r = fn.call(this);
      if(r) {
        results.push(r);
      }
      return r;
    });
  return ast.list(results);
};

exports.map = function(fn) {
  fn = normalizeArgs(arguments);
  var result, results = [];
  for(var i = 0; i < this.length; i++) {
    result = fn.call(this[i], this[i]);
    if(result) {
      results.push(result);
    } else {
      throw Error("Mapping failed: ", this[i]);
    }
  }
  return ast.list(results);
};

// fn return boolean
exports.filter = function(fn) {
  fn = normalizeArgs(arguments);
  var matching = [];
  this.forEach(function(el) {
    var result = fn.call(el);
    if(result) {
      matching.push(result);
    }
  });
  return ast.list(matching);
};

exports.rewrite = function(fn) {
  fn = normalizeArgs(arguments);
  return fn.call(this);
};

for(var p in exports) {
    if(exports.hasOwnProperty(p)) {
        Node.prototype[p] = exports[p];
    }
}

});