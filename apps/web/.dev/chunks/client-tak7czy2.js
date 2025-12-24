import {
  __commonJS,
  __toESM
} from "./client-4jeyk0v8.js";

// ../../../../node_modules/.bun/react@19.2.3/node_modules/react/cjs/react.development.js
var require_react_development = __commonJS((exports, module) => {
  (function() {
    function defineDeprecationWarning(methodName, info) {
      Object.defineProperty(Component.prototype, methodName, {
        get: function() {
          console.warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
        }
      });
    }
    function getIteratorFn(maybeIterable) {
      if (maybeIterable === null || typeof maybeIterable !== "object")
        return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return typeof maybeIterable === "function" ? maybeIterable : null;
    }
    function warnNoop(publicInstance, callerName) {
      publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
      var warningKey = publicInstance + "." + callerName;
      didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, publicInstance), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
    }
    function Component(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    function ComponentDummy() {}
    function PureComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    function noop() {}
    function testStringCoercion(value) {
      return "" + value;
    }
    function checkKeyStringCoercion(value) {
      try {
        testStringCoercion(value);
        var JSCompiler_inline_result = false;
      } catch (e) {
        JSCompiler_inline_result = true;
      }
      if (JSCompiler_inline_result) {
        JSCompiler_inline_result = console;
        var JSCompiler_temp_const = JSCompiler_inline_result.error;
        var JSCompiler_inline_result$jscomp$0 = typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
        JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
        return testStringCoercion(value);
      }
    }
    function getComponentNameFromType(type) {
      if (type == null)
        return null;
      if (typeof type === "function")
        return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
      if (typeof type === "string")
        return type;
      switch (type) {
        case REACT_FRAGMENT_TYPE:
          return "Fragment";
        case REACT_PROFILER_TYPE:
          return "Profiler";
        case REACT_STRICT_MODE_TYPE:
          return "StrictMode";
        case REACT_SUSPENSE_TYPE:
          return "Suspense";
        case REACT_SUSPENSE_LIST_TYPE:
          return "SuspenseList";
        case REACT_ACTIVITY_TYPE:
          return "Activity";
      }
      if (typeof type === "object")
        switch (typeof type.tag === "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_CONTEXT_TYPE:
            return type.displayName || "Context";
          case REACT_CONSUMER_TYPE:
            return (type._context.displayName || "Context") + ".Consumer";
          case REACT_FORWARD_REF_TYPE:
            var innerType = type.render;
            type = type.displayName;
            type || (type = innerType.displayName || innerType.name || "", type = type !== "" ? "ForwardRef(" + type + ")" : "ForwardRef");
            return type;
          case REACT_MEMO_TYPE:
            return innerType = type.displayName || null, innerType !== null ? innerType : getComponentNameFromType(type.type) || "Memo";
          case REACT_LAZY_TYPE:
            innerType = type._payload;
            type = type._init;
            try {
              return getComponentNameFromType(type(innerType));
            } catch (x) {}
        }
      return null;
    }
    function getTaskName(type) {
      if (type === REACT_FRAGMENT_TYPE)
        return "<>";
      if (typeof type === "object" && type !== null && type.$$typeof === REACT_LAZY_TYPE)
        return "<...>";
      try {
        var name = getComponentNameFromType(type);
        return name ? "<" + name + ">" : "<...>";
      } catch (x) {
        return "<...>";
      }
    }
    function getOwner() {
      var dispatcher = ReactSharedInternals.A;
      return dispatcher === null ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
      return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
      if (hasOwnProperty.call(config, "key")) {
        var getter = Object.getOwnPropertyDescriptor(config, "key").get;
        if (getter && getter.isReactWarning)
          return false;
      }
      return config.key !== undefined;
    }
    function defineKeyPropWarningGetter(props, displayName) {
      function warnAboutAccessingKey() {
        specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
      }
      warnAboutAccessingKey.isReactWarning = true;
      Object.defineProperty(props, "key", {
        get: warnAboutAccessingKey,
        configurable: true
      });
    }
    function elementRefGetterWithDeprecationWarning() {
      var componentName = getComponentNameFromType(this.type);
      didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
      componentName = this.props.ref;
      return componentName !== undefined ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
      var refProp = props.ref;
      type = {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        props,
        _owner: owner
      };
      (refProp !== undefined ? refProp : null) !== null ? Object.defineProperty(type, "ref", {
        enumerable: false,
        get: elementRefGetterWithDeprecationWarning
      }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
      type._store = {};
      Object.defineProperty(type._store, "validated", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: 0
      });
      Object.defineProperty(type, "_debugInfo", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      });
      Object.defineProperty(type, "_debugStack", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugStack
      });
      Object.defineProperty(type, "_debugTask", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugTask
      });
      Object.freeze && (Object.freeze(type.props), Object.freeze(type));
      return type;
    }
    function cloneAndReplaceKey(oldElement, newKey) {
      newKey = ReactElement(oldElement.type, newKey, oldElement.props, oldElement._owner, oldElement._debugStack, oldElement._debugTask);
      oldElement._store && (newKey._store.validated = oldElement._store.validated);
      return newKey;
    }
    function validateChildKeys(node) {
      isValidElement(node) ? node._store && (node._store.validated = 1) : typeof node === "object" && node !== null && node.$$typeof === REACT_LAZY_TYPE && (node._payload.status === "fulfilled" ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
      return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function escape(key) {
      var escaperLookup = { "=": "=0", ":": "=2" };
      return "$" + key.replace(/[=:]/g, function(match) {
        return escaperLookup[match];
      });
    }
    function getElementKey(element, index) {
      return typeof element === "object" && element !== null && element.key != null ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
    }
    function resolveThenable(thenable) {
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
        default:
          switch (typeof thenable.status === "string" ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
            thenable.status === "pending" && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
          }, function(error) {
            thenable.status === "pending" && (thenable.status = "rejected", thenable.reason = error);
          })), thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
          }
      }
      throw thenable;
    }
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
      var type = typeof children;
      if (type === "undefined" || type === "boolean")
        children = null;
      var invokeCallback = false;
      if (children === null)
        invokeCallback = true;
      else
        switch (type) {
          case "bigint":
          case "string":
          case "number":
            invokeCallback = true;
            break;
          case "object":
            switch (children.$$typeof) {
              case REACT_ELEMENT_TYPE:
              case REACT_PORTAL_TYPE:
                invokeCallback = true;
                break;
              case REACT_LAZY_TYPE:
                return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
            }
        }
      if (invokeCallback) {
        invokeCallback = children;
        callback = callback(invokeCallback);
        var childKey = nameSoFar === "" ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
        isArrayImpl(callback) ? (escapedPrefix = "", childKey != null && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
          return c;
        })) : callback != null && (isValidElement(callback) && (callback.key != null && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(callback, escapedPrefix + (callback.key == null || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + childKey), nameSoFar !== "" && invokeCallback != null && isValidElement(invokeCallback) && invokeCallback.key == null && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
        return 1;
      }
      invokeCallback = 0;
      childKey = nameSoFar === "" ? "." : nameSoFar + ":";
      if (isArrayImpl(children))
        for (var i = 0;i < children.length; i++)
          nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
      else if (i = getIteratorFn(children), typeof i === "function")
        for (i === children.entries && (didWarnAboutMaps || console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), didWarnAboutMaps = true), children = i.call(children), i = 0;!(nameSoFar = children.next()).done; )
          nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
      else if (type === "object") {
        if (typeof children.then === "function")
          return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
        array = String(children);
        throw Error("Objects are not valid as a React child (found: " + (array === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
      }
      return invokeCallback;
    }
    function mapChildren(children, func, context) {
      if (children == null)
        return children;
      var result = [], count = 0;
      mapIntoArray(children, result, "", "", function(child) {
        return func.call(context, child, count++);
      });
      return result;
    }
    function lazyInitializer(payload) {
      if (payload._status === -1) {
        var ioInfo = payload._ioInfo;
        ioInfo != null && (ioInfo.start = ioInfo.end = performance.now());
        ioInfo = payload._result;
        var thenable = ioInfo();
        thenable.then(function(moduleObject) {
          if (payload._status === 0 || payload._status === -1) {
            payload._status = 1;
            payload._result = moduleObject;
            var _ioInfo = payload._ioInfo;
            _ioInfo != null && (_ioInfo.end = performance.now());
            thenable.status === undefined && (thenable.status = "fulfilled", thenable.value = moduleObject);
          }
        }, function(error) {
          if (payload._status === 0 || payload._status === -1) {
            payload._status = 2;
            payload._result = error;
            var _ioInfo2 = payload._ioInfo;
            _ioInfo2 != null && (_ioInfo2.end = performance.now());
            thenable.status === undefined && (thenable.status = "rejected", thenable.reason = error);
          }
        });
        ioInfo = payload._ioInfo;
        if (ioInfo != null) {
          ioInfo.value = thenable;
          var displayName = thenable.displayName;
          typeof displayName === "string" && (ioInfo.name = displayName);
        }
        payload._status === -1 && (payload._status = 0, payload._result = thenable);
      }
      if (payload._status === 1)
        return ioInfo = payload._result, ioInfo === undefined && console.error(`lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))

Did you accidentally put curly braces around the import?`, ioInfo), "default" in ioInfo || console.error(`lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))`, ioInfo), ioInfo.default;
      throw payload._result;
    }
    function resolveDispatcher() {
      var dispatcher = ReactSharedInternals.H;
      dispatcher === null && console.error(`Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`);
      return dispatcher;
    }
    function releaseAsyncTransition() {
      ReactSharedInternals.asyncTransitions--;
    }
    function enqueueTask(task) {
      if (enqueueTaskImpl === null)
        try {
          var requireString = ("require" + Math.random()).slice(0, 7);
          enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
        } catch (_err) {
          enqueueTaskImpl = function(callback) {
            didWarnAboutMessageChannel === false && (didWarnAboutMessageChannel = true, typeof MessageChannel === "undefined" && console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."));
            var channel = new MessageChannel;
            channel.port1.onmessage = callback;
            channel.port2.postMessage(undefined);
          };
        }
      return enqueueTaskImpl(task);
    }
    function aggregateErrors(errors) {
      return 1 < errors.length && typeof AggregateError === "function" ? new AggregateError(errors) : errors[0];
    }
    function popActScope(prevActQueue, prevActScopeDepth) {
      prevActScopeDepth !== actScopeDepth - 1 && console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
      actScopeDepth = prevActScopeDepth;
    }
    function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
      var queue = ReactSharedInternals.actQueue;
      if (queue !== null)
        if (queue.length !== 0)
          try {
            flushActQueue(queue);
            enqueueTask(function() {
              return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
            });
            return;
          } catch (error) {
            ReactSharedInternals.thrownErrors.push(error);
          }
        else
          ReactSharedInternals.actQueue = null;
      0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
    }
    function flushActQueue(queue) {
      if (!isFlushing) {
        isFlushing = true;
        var i = 0;
        try {
          for (;i < queue.length; i++) {
            var callback = queue[i];
            do {
              ReactSharedInternals.didUsePromise = false;
              var continuation = callback(false);
              if (continuation !== null) {
                if (ReactSharedInternals.didUsePromise) {
                  queue[i] = callback;
                  queue.splice(0, i);
                  return;
                }
                callback = continuation;
              } else
                break;
            } while (1);
          }
          queue.length = 0;
        } catch (error) {
          queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
        } finally {
          isFlushing = false;
        }
      }
    }
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function(publicInstance) {
        warnNoop(publicInstance, "forceUpdate");
      },
      enqueueReplaceState: function(publicInstance) {
        warnNoop(publicInstance, "replaceState");
      },
      enqueueSetState: function(publicInstance) {
        warnNoop(publicInstance, "setState");
      }
    }, assign = Object.assign, emptyObject = {};
    Object.freeze(emptyObject);
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
      if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null)
        throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    var deprecatedAPIs = {
      isMounted: [
        "isMounted",
        "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
      ],
      replaceState: [
        "replaceState",
        "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
      ]
    };
    for (fnName in deprecatedAPIs)
      deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
    ComponentDummy.prototype = Component.prototype;
    deprecatedAPIs = PureComponent.prototype = new ComponentDummy;
    deprecatedAPIs.constructor = PureComponent;
    assign(deprecatedAPIs, Component.prototype);
    deprecatedAPIs.isPureReactComponent = true;
    var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = {
      H: null,
      A: null,
      T: null,
      S: null,
      actQueue: null,
      asyncTransitions: 0,
      isBatchingLegacy: false,
      didScheduleLegacyUpdate: false,
      didUsePromise: false,
      thrownErrors: [],
      getCurrentStack: null,
      recentlyCreatedOwnerStacks: 0
    }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
      return null;
    };
    deprecatedAPIs = {
      react_stack_bottom_frame: function(callStackForError) {
        return callStackForError();
      }
    };
    var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(deprecatedAPIs, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = typeof reportError === "function" ? reportError : function(error) {
      if (typeof window === "object" && typeof window.ErrorEvent === "function") {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: typeof error === "object" && error !== null && typeof error.message === "string" ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event))
          return;
      } else if (typeof process === "object" && typeof process.emit === "function") {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = typeof queueMicrotask === "function" ? function(callback) {
      queueMicrotask(function() {
        return queueMicrotask(callback);
      });
    } : enqueueTask;
    deprecatedAPIs = Object.freeze({
      __proto__: null,
      c: function(size) {
        return resolveDispatcher().useMemoCache(size);
      }
    });
    var fnName = {
      map: mapChildren,
      forEach: function(children, forEachFunc, forEachContext) {
        mapChildren(children, function() {
          forEachFunc.apply(this, arguments);
        }, forEachContext);
      },
      count: function(children) {
        var n = 0;
        mapChildren(children, function() {
          n++;
        });
        return n;
      },
      toArray: function(children) {
        return mapChildren(children, function(child) {
          return child;
        }) || [];
      },
      only: function(children) {
        if (!isValidElement(children))
          throw Error("React.Children.only expected to receive a single React element child.");
        return children;
      }
    };
    exports.Activity = REACT_ACTIVITY_TYPE;
    exports.Children = fnName;
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.__COMPILER_RUNTIME = deprecatedAPIs;
    exports.act = function(callback) {
      var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
      actScopeDepth++;
      var queue = ReactSharedInternals.actQueue = prevActQueue !== null ? prevActQueue : [], didAwaitActCall = false;
      try {
        var result = callback();
      } catch (error) {
        ReactSharedInternals.thrownErrors.push(error);
      }
      if (0 < ReactSharedInternals.thrownErrors.length)
        throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
      if (result !== null && typeof result === "object" && typeof result.then === "function") {
        var thenable = result;
        queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"));
        });
        return {
          then: function(resolve, reject) {
            didAwaitActCall = true;
            thenable.then(function(returnValue) {
              popActScope(prevActQueue, prevActScopeDepth);
              if (prevActScopeDepth === 0) {
                try {
                  flushActQueue(queue), enqueueTask(function() {
                    return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                  });
                } catch (error$0) {
                  ReactSharedInternals.thrownErrors.push(error$0);
                }
                if (0 < ReactSharedInternals.thrownErrors.length) {
                  var _thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
                  ReactSharedInternals.thrownErrors.length = 0;
                  reject(_thrownError);
                }
              } else
                resolve(returnValue);
            }, function(error) {
              popActScope(prevActQueue, prevActScopeDepth);
              0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
            });
          }
        };
      }
      var returnValue$jscomp$0 = result;
      popActScope(prevActQueue, prevActScopeDepth);
      prevActScopeDepth === 0 && (flushActQueue(queue), queue.length !== 0 && queueSeveralMicrotasks(function() {
        didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"));
      }), ReactSharedInternals.actQueue = null);
      if (0 < ReactSharedInternals.thrownErrors.length)
        throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
      return {
        then: function(resolve, reject) {
          didAwaitActCall = true;
          prevActScopeDepth === 0 ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
            return recursivelyFlushAsyncActWork(returnValue$jscomp$0, resolve, reject);
          })) : resolve(returnValue$jscomp$0);
        }
      };
    };
    exports.cache = function(fn) {
      return function() {
        return fn.apply(null, arguments);
      };
    };
    exports.cacheSignal = function() {
      return null;
    };
    exports.captureOwnerStack = function() {
      var getCurrentStack = ReactSharedInternals.getCurrentStack;
      return getCurrentStack === null ? null : getCurrentStack();
    };
    exports.cloneElement = function(element, config, children) {
      if (element === null || element === undefined)
        throw Error("The argument must be a React element, but you passed " + element + ".");
      var props = assign({}, element.props), key = element.key, owner = element._owner;
      if (config != null) {
        var JSCompiler_inline_result;
        a: {
          if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(config, "ref").get) && JSCompiler_inline_result.isReactWarning) {
            JSCompiler_inline_result = false;
            break a;
          }
          JSCompiler_inline_result = config.ref !== undefined;
        }
        JSCompiler_inline_result && (owner = getOwner());
        hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
        for (propName in config)
          !hasOwnProperty.call(config, propName) || propName === "key" || propName === "__self" || propName === "__source" || propName === "ref" && config.ref === undefined || (props[propName] = config[propName]);
      }
      var propName = arguments.length - 2;
      if (propName === 1)
        props.children = children;
      else if (1 < propName) {
        JSCompiler_inline_result = Array(propName);
        for (var i = 0;i < propName; i++)
          JSCompiler_inline_result[i] = arguments[i + 2];
        props.children = JSCompiler_inline_result;
      }
      props = ReactElement(element.type, key, props, owner, element._debugStack, element._debugTask);
      for (key = 2;key < arguments.length; key++)
        validateChildKeys(arguments[key]);
      return props;
    };
    exports.createContext = function(defaultValue) {
      defaultValue = {
        $$typeof: REACT_CONTEXT_TYPE,
        _currentValue: defaultValue,
        _currentValue2: defaultValue,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      };
      defaultValue.Provider = defaultValue;
      defaultValue.Consumer = {
        $$typeof: REACT_CONSUMER_TYPE,
        _context: defaultValue
      };
      defaultValue._currentRenderer = null;
      defaultValue._currentRenderer2 = null;
      return defaultValue;
    };
    exports.createElement = function(type, config, children) {
      for (var i = 2;i < arguments.length; i++)
        validateChildKeys(arguments[i]);
      i = {};
      var key = null;
      if (config != null)
        for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
          hasOwnProperty.call(config, propName) && propName !== "key" && propName !== "__self" && propName !== "__source" && (i[propName] = config[propName]);
      var childrenLength = arguments.length - 2;
      if (childrenLength === 1)
        i.children = children;
      else if (1 < childrenLength) {
        for (var childArray = Array(childrenLength), _i = 0;_i < childrenLength; _i++)
          childArray[_i] = arguments[_i + 2];
        Object.freeze && Object.freeze(childArray);
        i.children = childArray;
      }
      if (type && type.defaultProps)
        for (propName in childrenLength = type.defaultProps, childrenLength)
          i[propName] === undefined && (i[propName] = childrenLength[propName]);
      key && defineKeyPropWarningGetter(i, typeof type === "function" ? type.displayName || type.name || "Unknown" : type);
      var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
      return ReactElement(type, key, i, getOwner(), propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack, propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
    exports.createRef = function() {
      var refObject = { current: null };
      Object.seal(refObject);
      return refObject;
    };
    exports.forwardRef = function(render) {
      render != null && render.$$typeof === REACT_MEMO_TYPE ? console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).") : typeof render !== "function" ? console.error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render) : render.length !== 0 && render.length !== 2 && console.error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
      render != null && render.defaultProps != null && console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");
      var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
      Object.defineProperty(elementType, "displayName", {
        enumerable: false,
        configurable: true,
        get: function() {
          return ownName;
        },
        set: function(name) {
          ownName = name;
          render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
        }
      });
      return elementType;
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
      ctor = { _status: -1, _result: ctor };
      var lazyType = {
        $$typeof: REACT_LAZY_TYPE,
        _payload: ctor,
        _init: lazyInitializer
      }, ioInfo = {
        name: "lazy",
        start: -1,
        end: -1,
        value: null,
        owner: null,
        debugStack: Error("react-stack-top-frame"),
        debugTask: console.createTask ? console.createTask("lazy()") : null
      };
      ctor._ioInfo = ioInfo;
      lazyType._debugInfo = [{ awaited: ioInfo }];
      return lazyType;
    };
    exports.memo = function(type, compare) {
      type == null && console.error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
      compare = {
        $$typeof: REACT_MEMO_TYPE,
        type,
        compare: compare === undefined ? null : compare
      };
      var ownName;
      Object.defineProperty(compare, "displayName", {
        enumerable: false,
        configurable: true,
        get: function() {
          return ownName;
        },
        set: function(name) {
          ownName = name;
          type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
        }
      });
      return compare;
    };
    exports.startTransition = function(scope) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      currentTransition._updatedFibers = new Set;
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
        onStartTransitionFinish !== null && onStartTransitionFinish(currentTransition, returnValue);
        typeof returnValue === "object" && returnValue !== null && typeof returnValue.then === "function" && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
      } catch (error) {
        reportGlobalError(error);
      } finally {
        prevTransition === null && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")), prevTransition !== null && currentTransition.types !== null && (prevTransition.types !== null && prevTransition.types !== currentTransition.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    };
    exports.unstable_useCacheRefresh = function() {
      return resolveDispatcher().useCacheRefresh();
    };
    exports.use = function(usable) {
      return resolveDispatcher().use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
      return resolveDispatcher().useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
      return resolveDispatcher().useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
      var dispatcher = resolveDispatcher();
      Context.$$typeof === REACT_CONSUMER_TYPE && console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?");
      return dispatcher.useContext(Context);
    };
    exports.useDebugValue = function(value, formatterFn) {
      return resolveDispatcher().useDebugValue(value, formatterFn);
    };
    exports.useDeferredValue = function(value, initialValue) {
      return resolveDispatcher().useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create, deps) {
      create == null && console.warn("React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?");
      return resolveDispatcher().useEffect(create, deps);
    };
    exports.useEffectEvent = function(callback) {
      return resolveDispatcher().useEffectEvent(callback);
    };
    exports.useId = function() {
      return resolveDispatcher().useId();
    };
    exports.useImperativeHandle = function(ref, create, deps) {
      return resolveDispatcher().useImperativeHandle(ref, create, deps);
    };
    exports.useInsertionEffect = function(create, deps) {
      create == null && console.warn("React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?");
      return resolveDispatcher().useInsertionEffect(create, deps);
    };
    exports.useLayoutEffect = function(create, deps) {
      create == null && console.warn("React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?");
      return resolveDispatcher().useLayoutEffect(create, deps);
    };
    exports.useMemo = function(create, deps) {
      return resolveDispatcher().useMemo(create, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
      return resolveDispatcher().useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
      return resolveDispatcher().useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
      return resolveDispatcher().useRef(initialValue);
    };
    exports.useState = function(initialState) {
      return resolveDispatcher().useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
      return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    };
    exports.useTransition = function() {
      return resolveDispatcher().useTransition();
    };
    exports.version = "19.2.3";
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  })();
});

// ../../../../node_modules/.bun/react@19.2.3/node_modules/react/index.js
var require_react = __commonJS((exports, module) => {
  var react_development = __toESM(require_react_development());
  if (false) {} else {
    module.exports = react_development;
  }
});

// ../../../../node_modules/.bun/react@19.2.3/node_modules/react/cjs/react-jsx-runtime.development.js
var require_react_jsx_runtime_development = __commonJS((exports) => {
  var React = __toESM(require_react());
  (function() {
    function getComponentNameFromType(type) {
      if (type == null)
        return null;
      if (typeof type === "function")
        return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
      if (typeof type === "string")
        return type;
      switch (type) {
        case REACT_FRAGMENT_TYPE:
          return "Fragment";
        case REACT_PROFILER_TYPE:
          return "Profiler";
        case REACT_STRICT_MODE_TYPE:
          return "StrictMode";
        case REACT_SUSPENSE_TYPE:
          return "Suspense";
        case REACT_SUSPENSE_LIST_TYPE:
          return "SuspenseList";
        case REACT_ACTIVITY_TYPE:
          return "Activity";
      }
      if (typeof type === "object")
        switch (typeof type.tag === "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_CONTEXT_TYPE:
            return type.displayName || "Context";
          case REACT_CONSUMER_TYPE:
            return (type._context.displayName || "Context") + ".Consumer";
          case REACT_FORWARD_REF_TYPE:
            var innerType = type.render;
            type = type.displayName;
            type || (type = innerType.displayName || innerType.name || "", type = type !== "" ? "ForwardRef(" + type + ")" : "ForwardRef");
            return type;
          case REACT_MEMO_TYPE:
            return innerType = type.displayName || null, innerType !== null ? innerType : getComponentNameFromType(type.type) || "Memo";
          case REACT_LAZY_TYPE:
            innerType = type._payload;
            type = type._init;
            try {
              return getComponentNameFromType(type(innerType));
            } catch (x) {}
        }
      return null;
    }
    function testStringCoercion(value) {
      return "" + value;
    }
    function checkKeyStringCoercion(value) {
      try {
        testStringCoercion(value);
        var JSCompiler_inline_result = false;
      } catch (e) {
        JSCompiler_inline_result = true;
      }
      if (JSCompiler_inline_result) {
        JSCompiler_inline_result = console;
        var JSCompiler_temp_const = JSCompiler_inline_result.error;
        var JSCompiler_inline_result$jscomp$0 = typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
        JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
        return testStringCoercion(value);
      }
    }
    function getTaskName(type) {
      if (type === REACT_FRAGMENT_TYPE)
        return "<>";
      if (typeof type === "object" && type !== null && type.$$typeof === REACT_LAZY_TYPE)
        return "<...>";
      try {
        var name = getComponentNameFromType(type);
        return name ? "<" + name + ">" : "<...>";
      } catch (x) {
        return "<...>";
      }
    }
    function getOwner() {
      var dispatcher = ReactSharedInternals.A;
      return dispatcher === null ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
      return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
      if (hasOwnProperty.call(config, "key")) {
        var getter = Object.getOwnPropertyDescriptor(config, "key").get;
        if (getter && getter.isReactWarning)
          return false;
      }
      return config.key !== undefined;
    }
    function defineKeyPropWarningGetter(props, displayName) {
      function warnAboutAccessingKey() {
        specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
      }
      warnAboutAccessingKey.isReactWarning = true;
      Object.defineProperty(props, "key", {
        get: warnAboutAccessingKey,
        configurable: true
      });
    }
    function elementRefGetterWithDeprecationWarning() {
      var componentName = getComponentNameFromType(this.type);
      didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
      componentName = this.props.ref;
      return componentName !== undefined ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
      var refProp = props.ref;
      type = {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        props,
        _owner: owner
      };
      (refProp !== undefined ? refProp : null) !== null ? Object.defineProperty(type, "ref", {
        enumerable: false,
        get: elementRefGetterWithDeprecationWarning
      }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
      type._store = {};
      Object.defineProperty(type._store, "validated", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: 0
      });
      Object.defineProperty(type, "_debugInfo", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      });
      Object.defineProperty(type, "_debugStack", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugStack
      });
      Object.defineProperty(type, "_debugTask", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugTask
      });
      Object.freeze && (Object.freeze(type.props), Object.freeze(type));
      return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
      var children = config.children;
      if (children !== undefined)
        if (isStaticChildren)
          if (isArrayImpl(children)) {
            for (isStaticChildren = 0;isStaticChildren < children.length; isStaticChildren++)
              validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
          } else
            console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else
          validateChildKeys(children);
      if (hasOwnProperty.call(config, "key")) {
        children = getComponentNameFromType(type);
        var keys = Object.keys(config).filter(function(k) {
          return k !== "key";
        });
        isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
        didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = true);
      }
      children = null;
      maybeKey !== undefined && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
      hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
      if ("key" in config) {
        maybeKey = {};
        for (var propName in config)
          propName !== "key" && (maybeKey[propName] = config[propName]);
      } else
        maybeKey = config;
      children && defineKeyPropWarningGetter(maybeKey, typeof type === "function" ? type.displayName || type.name || "Unknown" : type);
      return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
      isValidElement(node) ? node._store && (node._store.validated = 1) : typeof node === "object" && node !== null && node.$$typeof === REACT_LAZY_TYPE && (node._payload.status === "fulfilled" ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
      return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
      return null;
    };
    React = {
      react_stack_bottom_frame: function(callStackForError) {
        return callStackForError();
      }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsx = function(type, config, maybeKey) {
      var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
      return jsxDEVImpl(type, config, maybeKey, false, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
    exports.jsxs = function(type, config, maybeKey) {
      var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
      return jsxDEVImpl(type, config, maybeKey, true, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
  })();
});

// ../../../../node_modules/.bun/react@19.2.3/node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS((exports, module) => {
  var react_jsx_runtime_development = __toESM(require_react_jsx_runtime_development());
  if (false) {} else {
    module.exports = react_jsx_runtime_development;
  }
});

// ../../../../node_modules/.bun/react@19.2.3/node_modules/react/cjs/react-jsx-dev-runtime.development.js
var require_react_jsx_dev_runtime_development = __commonJS((exports) => {
  var React6 = __toESM(require_react());
  (function() {
    function getComponentNameFromType(type) {
      if (type == null)
        return null;
      if (typeof type === "function")
        return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
      if (typeof type === "string")
        return type;
      switch (type) {
        case REACT_FRAGMENT_TYPE:
          return "Fragment";
        case REACT_PROFILER_TYPE:
          return "Profiler";
        case REACT_STRICT_MODE_TYPE:
          return "StrictMode";
        case REACT_SUSPENSE_TYPE:
          return "Suspense";
        case REACT_SUSPENSE_LIST_TYPE:
          return "SuspenseList";
        case REACT_ACTIVITY_TYPE:
          return "Activity";
      }
      if (typeof type === "object")
        switch (typeof type.tag === "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_CONTEXT_TYPE:
            return type.displayName || "Context";
          case REACT_CONSUMER_TYPE:
            return (type._context.displayName || "Context") + ".Consumer";
          case REACT_FORWARD_REF_TYPE:
            var innerType = type.render;
            type = type.displayName;
            type || (type = innerType.displayName || innerType.name || "", type = type !== "" ? "ForwardRef(" + type + ")" : "ForwardRef");
            return type;
          case REACT_MEMO_TYPE:
            return innerType = type.displayName || null, innerType !== null ? innerType : getComponentNameFromType(type.type) || "Memo";
          case REACT_LAZY_TYPE:
            innerType = type._payload;
            type = type._init;
            try {
              return getComponentNameFromType(type(innerType));
            } catch (x) {}
        }
      return null;
    }
    function testStringCoercion(value) {
      return "" + value;
    }
    function checkKeyStringCoercion(value) {
      try {
        testStringCoercion(value);
        var JSCompiler_inline_result = false;
      } catch (e) {
        JSCompiler_inline_result = true;
      }
      if (JSCompiler_inline_result) {
        JSCompiler_inline_result = console;
        var JSCompiler_temp_const = JSCompiler_inline_result.error;
        var JSCompiler_inline_result$jscomp$0 = typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
        JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
        return testStringCoercion(value);
      }
    }
    function getTaskName(type) {
      if (type === REACT_FRAGMENT_TYPE)
        return "<>";
      if (typeof type === "object" && type !== null && type.$$typeof === REACT_LAZY_TYPE)
        return "<...>";
      try {
        var name = getComponentNameFromType(type);
        return name ? "<" + name + ">" : "<...>";
      } catch (x) {
        return "<...>";
      }
    }
    function getOwner() {
      var dispatcher = ReactSharedInternals.A;
      return dispatcher === null ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
      return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
      if (hasOwnProperty.call(config, "key")) {
        var getter = Object.getOwnPropertyDescriptor(config, "key").get;
        if (getter && getter.isReactWarning)
          return false;
      }
      return config.key !== undefined;
    }
    function defineKeyPropWarningGetter(props, displayName) {
      function warnAboutAccessingKey() {
        specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
      }
      warnAboutAccessingKey.isReactWarning = true;
      Object.defineProperty(props, "key", {
        get: warnAboutAccessingKey,
        configurable: true
      });
    }
    function elementRefGetterWithDeprecationWarning() {
      var componentName = getComponentNameFromType(this.type);
      didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
      componentName = this.props.ref;
      return componentName !== undefined ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
      var refProp = props.ref;
      type = {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        props,
        _owner: owner
      };
      (refProp !== undefined ? refProp : null) !== null ? Object.defineProperty(type, "ref", {
        enumerable: false,
        get: elementRefGetterWithDeprecationWarning
      }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
      type._store = {};
      Object.defineProperty(type._store, "validated", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: 0
      });
      Object.defineProperty(type, "_debugInfo", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      });
      Object.defineProperty(type, "_debugStack", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugStack
      });
      Object.defineProperty(type, "_debugTask", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugTask
      });
      Object.freeze && (Object.freeze(type.props), Object.freeze(type));
      return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
      var children = config.children;
      if (children !== undefined)
        if (isStaticChildren)
          if (isArrayImpl(children)) {
            for (isStaticChildren = 0;isStaticChildren < children.length; isStaticChildren++)
              validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
          } else
            console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else
          validateChildKeys(children);
      if (hasOwnProperty.call(config, "key")) {
        children = getComponentNameFromType(type);
        var keys = Object.keys(config).filter(function(k) {
          return k !== "key";
        });
        isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
        didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = true);
      }
      children = null;
      maybeKey !== undefined && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
      hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
      if ("key" in config) {
        maybeKey = {};
        for (var propName in config)
          propName !== "key" && (maybeKey[propName] = config[propName]);
      } else
        maybeKey = config;
      children && defineKeyPropWarningGetter(maybeKey, typeof type === "function" ? type.displayName || type.name || "Unknown" : type);
      return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
      isValidElement(node) ? node._store && (node._store.validated = 1) : typeof node === "object" && node !== null && node.$$typeof === REACT_LAZY_TYPE && (node._payload.status === "fulfilled" ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
      return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React6.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
      return null;
    };
    React6 = {
      react_stack_bottom_frame: function(callStackForError) {
        return callStackForError();
      }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React6.react_stack_bottom_frame.bind(React6, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
      var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
      return jsxDEVImpl(type, config, maybeKey, isStaticChildren, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
  })();
});

// ../../../../node_modules/.bun/react@19.2.3/node_modules/react/jsx-dev-runtime.js
var require_jsx_dev_runtime = __commonJS((exports, module) => {
  var react_jsx_dev_runtime_development = __toESM(require_react_jsx_dev_runtime_development());
  if (false) {} else {
    module.exports = react_jsx_dev_runtime_development;
  }
});

// ../../../../node_modules/.bun/react-dom@19.2.3+83d5fd7b249dbeef/node_modules/react-dom/cjs/react-dom.development.js
var require_react_dom_development = __commonJS((exports) => {
  var React6 = __toESM(require_react());
  (function() {
    function noop2() {}
    function testStringCoercion(value) {
      return "" + value;
    }
    function createPortal$1(children, containerInfo, implementation) {
      var key = 3 < arguments.length && arguments[3] !== undefined ? arguments[3] : null;
      try {
        testStringCoercion(key);
        var JSCompiler_inline_result = false;
      } catch (e) {
        JSCompiler_inline_result = true;
      }
      JSCompiler_inline_result && (console.error("The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", typeof Symbol === "function" && Symbol.toStringTag && key[Symbol.toStringTag] || key.constructor.name || "Object"), testStringCoercion(key));
      return {
        $$typeof: REACT_PORTAL_TYPE,
        key: key == null ? null : "" + key,
        children,
        containerInfo,
        implementation
      };
    }
    function getCrossOriginStringAs(as, input) {
      if (as === "font")
        return "";
      if (typeof input === "string")
        return input === "use-credentials" ? input : "";
    }
    function getValueDescriptorExpectingObjectForWarning(thing) {
      return thing === null ? "`null`" : thing === undefined ? "`undefined`" : thing === "" ? "an empty string" : 'something with type "' + typeof thing + '"';
    }
    function getValueDescriptorExpectingEnumForWarning(thing) {
      return thing === null ? "`null`" : thing === undefined ? "`undefined`" : thing === "" ? "an empty string" : typeof thing === "string" ? JSON.stringify(thing) : typeof thing === "number" ? "`" + thing + "`" : 'something with type "' + typeof thing + '"';
    }
    function resolveDispatcher() {
      var dispatcher = ReactSharedInternals.H;
      dispatcher === null && console.error(`Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`);
      return dispatcher;
    }
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var Internals = {
      d: {
        f: noop2,
        r: function() {
          throw Error("Invalid form element. requestFormReset must be passed a form that was rendered by React.");
        },
        D: noop2,
        C: noop2,
        L: noop2,
        m: noop2,
        X: noop2,
        S: noop2,
        M: noop2
      },
      p: 0,
      findDOMNode: null
    }, REACT_PORTAL_TYPE = Symbol.for("react.portal"), ReactSharedInternals = React6.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    typeof Map === "function" && Map.prototype != null && typeof Map.prototype.forEach === "function" && typeof Set === "function" && Set.prototype != null && typeof Set.prototype.clear === "function" && typeof Set.prototype.forEach === "function" || console.error("React depends on Map and Set built-in types. Make sure that you load a polyfill in older browsers. https://reactjs.org/link/react-polyfills");
    exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
    exports.createPortal = function(children, container) {
      var key = 2 < arguments.length && arguments[2] !== undefined ? arguments[2] : null;
      if (!container || container.nodeType !== 1 && container.nodeType !== 9 && container.nodeType !== 11)
        throw Error("Target container is not a DOM element.");
      return createPortal$1(children, container, null, key);
    };
    exports.flushSync = function(fn) {
      var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
      try {
        if (ReactSharedInternals.T = null, Internals.p = 2, fn)
          return fn();
      } finally {
        ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f() && console.error("flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering. Consider moving this call to a scheduler task or micro task.");
      }
    };
    exports.preconnect = function(href, options) {
      typeof href === "string" && href ? options != null && typeof options !== "object" ? console.error("ReactDOM.preconnect(): Expected the `options` argument (second) to be an object but encountered %s instead. The only supported option at this time is `crossOrigin` which accepts a string.", getValueDescriptorExpectingEnumForWarning(options)) : options != null && typeof options.crossOrigin !== "string" && console.error("ReactDOM.preconnect(): Expected the `crossOrigin` option (second argument) to be a string but encountered %s instead. Try removing this option or passing a string value instead.", getValueDescriptorExpectingObjectForWarning(options.crossOrigin)) : console.error("ReactDOM.preconnect(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", getValueDescriptorExpectingObjectForWarning(href));
      typeof href === "string" && (options ? (options = options.crossOrigin, options = typeof options === "string" ? options === "use-credentials" ? options : "" : undefined) : options = null, Internals.d.C(href, options));
    };
    exports.prefetchDNS = function(href) {
      if (typeof href !== "string" || !href)
        console.error("ReactDOM.prefetchDNS(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", getValueDescriptorExpectingObjectForWarning(href));
      else if (1 < arguments.length) {
        var options = arguments[1];
        typeof options === "object" && options.hasOwnProperty("crossOrigin") ? console.error("ReactDOM.prefetchDNS(): Expected only one argument, `href`, but encountered %s as a second argument instead. This argument is reserved for future options and is currently disallowed. It looks like the you are attempting to set a crossOrigin property for this DNS lookup hint. Browsers do not perform DNS queries using CORS and setting this attribute on the resource hint has no effect. Try calling ReactDOM.prefetchDNS() with just a single string argument, `href`.", getValueDescriptorExpectingEnumForWarning(options)) : console.error("ReactDOM.prefetchDNS(): Expected only one argument, `href`, but encountered %s as a second argument instead. This argument is reserved for future options and is currently disallowed. Try calling ReactDOM.prefetchDNS() with just a single string argument, `href`.", getValueDescriptorExpectingEnumForWarning(options));
      }
      typeof href === "string" && Internals.d.D(href);
    };
    exports.preinit = function(href, options) {
      typeof href === "string" && href ? options == null || typeof options !== "object" ? console.error("ReactDOM.preinit(): Expected the `options` argument (second) to be an object with an `as` property describing the type of resource to be preinitialized but encountered %s instead.", getValueDescriptorExpectingEnumForWarning(options)) : options.as !== "style" && options.as !== "script" && console.error('ReactDOM.preinit(): Expected the `as` property in the `options` argument (second) to contain a valid value describing the type of resource to be preinitialized but encountered %s instead. Valid values for `as` are "style" and "script".', getValueDescriptorExpectingEnumForWarning(options.as)) : console.error("ReactDOM.preinit(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", getValueDescriptorExpectingObjectForWarning(href));
      if (typeof href === "string" && options && typeof options.as === "string") {
        var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = typeof options.integrity === "string" ? options.integrity : undefined, fetchPriority = typeof options.fetchPriority === "string" ? options.fetchPriority : undefined;
        as === "style" ? Internals.d.S(href, typeof options.precedence === "string" ? options.precedence : undefined, {
          crossOrigin,
          integrity,
          fetchPriority
        }) : as === "script" && Internals.d.X(href, {
          crossOrigin,
          integrity,
          fetchPriority,
          nonce: typeof options.nonce === "string" ? options.nonce : undefined
        });
      }
    };
    exports.preinitModule = function(href, options) {
      var encountered = "";
      typeof href === "string" && href || (encountered += " The `href` argument encountered was " + getValueDescriptorExpectingObjectForWarning(href) + ".");
      options !== undefined && typeof options !== "object" ? encountered += " The `options` argument encountered was " + getValueDescriptorExpectingObjectForWarning(options) + "." : options && ("as" in options) && options.as !== "script" && (encountered += " The `as` option encountered was " + getValueDescriptorExpectingEnumForWarning(options.as) + ".");
      if (encountered)
        console.error("ReactDOM.preinitModule(): Expected up to two arguments, a non-empty `href` string and, optionally, an `options` object with a valid `as` property.%s", encountered);
      else
        switch (encountered = options && typeof options.as === "string" ? options.as : "script", encountered) {
          case "script":
            break;
          default:
            encountered = getValueDescriptorExpectingEnumForWarning(encountered), console.error('ReactDOM.preinitModule(): Currently the only supported "as" type for this function is "script" but received "%s" instead. This warning was generated for `href` "%s". In the future other module types will be supported, aligning with the import-attributes proposal. Learn more here: (https://github.com/tc39/proposal-import-attributes)', encountered, href);
        }
      if (typeof href === "string")
        if (typeof options === "object" && options !== null) {
          if (options.as == null || options.as === "script")
            encountered = getCrossOriginStringAs(options.as, options.crossOrigin), Internals.d.M(href, {
              crossOrigin: encountered,
              integrity: typeof options.integrity === "string" ? options.integrity : undefined,
              nonce: typeof options.nonce === "string" ? options.nonce : undefined
            });
        } else
          options == null && Internals.d.M(href);
    };
    exports.preload = function(href, options) {
      var encountered = "";
      typeof href === "string" && href || (encountered += " The `href` argument encountered was " + getValueDescriptorExpectingObjectForWarning(href) + ".");
      options == null || typeof options !== "object" ? encountered += " The `options` argument encountered was " + getValueDescriptorExpectingObjectForWarning(options) + "." : typeof options.as === "string" && options.as || (encountered += " The `as` option encountered was " + getValueDescriptorExpectingObjectForWarning(options.as) + ".");
      encountered && console.error('ReactDOM.preload(): Expected two arguments, a non-empty `href` string and an `options` object with an `as` property valid for a `<link rel="preload" as="..." />` tag.%s', encountered);
      if (typeof href === "string" && typeof options === "object" && options !== null && typeof options.as === "string") {
        encountered = options.as;
        var crossOrigin = getCrossOriginStringAs(encountered, options.crossOrigin);
        Internals.d.L(href, encountered, {
          crossOrigin,
          integrity: typeof options.integrity === "string" ? options.integrity : undefined,
          nonce: typeof options.nonce === "string" ? options.nonce : undefined,
          type: typeof options.type === "string" ? options.type : undefined,
          fetchPriority: typeof options.fetchPriority === "string" ? options.fetchPriority : undefined,
          referrerPolicy: typeof options.referrerPolicy === "string" ? options.referrerPolicy : undefined,
          imageSrcSet: typeof options.imageSrcSet === "string" ? options.imageSrcSet : undefined,
          imageSizes: typeof options.imageSizes === "string" ? options.imageSizes : undefined,
          media: typeof options.media === "string" ? options.media : undefined
        });
      }
    };
    exports.preloadModule = function(href, options) {
      var encountered = "";
      typeof href === "string" && href || (encountered += " The `href` argument encountered was " + getValueDescriptorExpectingObjectForWarning(href) + ".");
      options !== undefined && typeof options !== "object" ? encountered += " The `options` argument encountered was " + getValueDescriptorExpectingObjectForWarning(options) + "." : options && ("as" in options) && typeof options.as !== "string" && (encountered += " The `as` option encountered was " + getValueDescriptorExpectingObjectForWarning(options.as) + ".");
      encountered && console.error('ReactDOM.preloadModule(): Expected two arguments, a non-empty `href` string and, optionally, an `options` object with an `as` property valid for a `<link rel="modulepreload" as="..." />` tag.%s', encountered);
      typeof href === "string" && (options ? (encountered = getCrossOriginStringAs(options.as, options.crossOrigin), Internals.d.m(href, {
        as: typeof options.as === "string" && options.as !== "script" ? options.as : undefined,
        crossOrigin: encountered,
        integrity: typeof options.integrity === "string" ? options.integrity : undefined
      })) : Internals.d.m(href));
    };
    exports.requestFormReset = function(form) {
      Internals.d.r(form);
    };
    exports.unstable_batchedUpdates = function(fn, a) {
      return fn(a);
    };
    exports.useFormState = function(action, initialState, permalink) {
      return resolveDispatcher().useFormState(action, initialState, permalink);
    };
    exports.useFormStatus = function() {
      return resolveDispatcher().useHostTransitionStatus();
    };
    exports.version = "19.2.3";
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  })();
});

// ../../../../node_modules/.bun/react-dom@19.2.3+83d5fd7b249dbeef/node_modules/react-dom/index.js
var require_react_dom = __commonJS((exports, module) => {
  var react_dom_development = __toESM(require_react_dom_development());
  if (false) {} else {
    module.exports = react_dom_development;
  }
});

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/timeoutManager.js
var defaultTimeoutProvider = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timeoutId) => clearTimeout(timeoutId),
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (intervalId) => clearInterval(intervalId)
};
var TimeoutManager = class {
  #provider = defaultTimeoutProvider;
  #providerCalled = false;
  setTimeoutProvider(provider) {
    if (true) {
      if (this.#providerCalled && provider !== this.#provider) {
        console.error(`[timeoutManager]: Switching provider after calls to previous provider might result in unexpected behavior.`, { previous: this.#provider, provider });
      }
    }
    this.#provider = provider;
    if (true) {
      this.#providerCalled = false;
    }
  }
  setTimeout(callback, delay) {
    if (true) {
      this.#providerCalled = true;
    }
    return this.#provider.setTimeout(callback, delay);
  }
  clearTimeout(timeoutId) {
    this.#provider.clearTimeout(timeoutId);
  }
  setInterval(callback, delay) {
    if (true) {
      this.#providerCalled = true;
    }
    return this.#provider.setInterval(callback, delay);
  }
  clearInterval(intervalId) {
    this.#provider.clearInterval(intervalId);
  }
};
var timeoutManager = new TimeoutManager;
function systemSetTimeoutZero(callback) {
  setTimeout(callback, 0);
}

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/utils.js
var isServer = typeof window === "undefined" || "Deno" in globalThis;
function noop() {}
function functionalUpdate(updater, input) {
  return typeof updater === "function" ? updater(input) : updater;
}
function isValidTimeout(value) {
  return typeof value === "number" && value >= 0 && value !== Infinity;
}
function timeUntilStale(updatedAt, staleTime) {
  return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0);
}
function resolveStaleTime(staleTime, query) {
  return typeof staleTime === "function" ? staleTime(query) : staleTime;
}
function resolveEnabled(enabled, query) {
  return typeof enabled === "function" ? enabled(query) : enabled;
}
function matchQuery(filters, query) {
  const {
    type = "all",
    exact,
    fetchStatus,
    predicate,
    queryKey,
    stale
  } = filters;
  if (queryKey) {
    if (exact) {
      if (query.queryHash !== hashQueryKeyByOptions(queryKey, query.options)) {
        return false;
      }
    } else if (!partialMatchKey(query.queryKey, queryKey)) {
      return false;
    }
  }
  if (type !== "all") {
    const isActive = query.isActive();
    if (type === "active" && !isActive) {
      return false;
    }
    if (type === "inactive" && isActive) {
      return false;
    }
  }
  if (typeof stale === "boolean" && query.isStale() !== stale) {
    return false;
  }
  if (fetchStatus && fetchStatus !== query.state.fetchStatus) {
    return false;
  }
  if (predicate && !predicate(query)) {
    return false;
  }
  return true;
}
function matchMutation(filters, mutation) {
  const { exact, status, predicate, mutationKey } = filters;
  if (mutationKey) {
    if (!mutation.options.mutationKey) {
      return false;
    }
    if (exact) {
      if (hashKey(mutation.options.mutationKey) !== hashKey(mutationKey)) {
        return false;
      }
    } else if (!partialMatchKey(mutation.options.mutationKey, mutationKey)) {
      return false;
    }
  }
  if (status && mutation.state.status !== status) {
    return false;
  }
  if (predicate && !predicate(mutation)) {
    return false;
  }
  return true;
}
function hashQueryKeyByOptions(queryKey, options) {
  const hashFn = options?.queryKeyHashFn || hashKey;
  return hashFn(queryKey);
}
function hashKey(queryKey) {
  return JSON.stringify(queryKey, (_, val) => isPlainObject(val) ? Object.keys(val).sort().reduce((result, key) => {
    result[key] = val[key];
    return result;
  }, {}) : val);
}
function partialMatchKey(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    return Object.keys(b).every((key) => partialMatchKey(a[key], b[key]));
  }
  return false;
}
var hasOwn = Object.prototype.hasOwnProperty;
function replaceEqualDeep(a, b) {
  if (a === b) {
    return a;
  }
  const array = isPlainArray(a) && isPlainArray(b);
  if (!array && !(isPlainObject(a) && isPlainObject(b)))
    return b;
  const aItems = array ? a : Object.keys(a);
  const aSize = aItems.length;
  const bItems = array ? b : Object.keys(b);
  const bSize = bItems.length;
  const copy = array ? new Array(bSize) : {};
  let equalItems = 0;
  for (let i = 0;i < bSize; i++) {
    const key = array ? i : bItems[i];
    const aItem = a[key];
    const bItem = b[key];
    if (aItem === bItem) {
      copy[key] = aItem;
      if (array ? i < aSize : hasOwn.call(a, key))
        equalItems++;
      continue;
    }
    if (aItem === null || bItem === null || typeof aItem !== "object" || typeof bItem !== "object") {
      copy[key] = bItem;
      continue;
    }
    const v = replaceEqualDeep(aItem, bItem);
    copy[key] = v;
    if (v === aItem)
      equalItems++;
  }
  return aSize === bSize && equalItems === aSize ? a : copy;
}
function shallowEqualObjects(a, b) {
  if (!b || Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }
  for (const key in a) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}
function isPlainArray(value) {
  return Array.isArray(value) && value.length === Object.keys(value).length;
}
function isPlainObject(o) {
  if (!hasObjectPrototype(o)) {
    return false;
  }
  const ctor = o.constructor;
  if (ctor === undefined) {
    return true;
  }
  const prot = ctor.prototype;
  if (!hasObjectPrototype(prot)) {
    return false;
  }
  if (!prot.hasOwnProperty("isPrototypeOf")) {
    return false;
  }
  if (Object.getPrototypeOf(o) !== Object.prototype) {
    return false;
  }
  return true;
}
function hasObjectPrototype(o) {
  return Object.prototype.toString.call(o) === "[object Object]";
}
function sleep(timeout) {
  return new Promise((resolve) => {
    timeoutManager.setTimeout(resolve, timeout);
  });
}
function replaceData(prevData, data, options) {
  if (typeof options.structuralSharing === "function") {
    return options.structuralSharing(prevData, data);
  } else if (options.structuralSharing !== false) {
    if (true) {
      try {
        return replaceEqualDeep(prevData, data);
      } catch (error) {
        console.error(`Structural sharing requires data to be JSON serializable. To fix this, turn off structuralSharing or return JSON-serializable data from your queryFn. [${options.queryHash}]: ${error}`);
        throw error;
      }
    }
    return replaceEqualDeep(prevData, data);
  }
  return data;
}
function addToEnd(items, item, max = 0) {
  const newItems = [...items, item];
  return max && newItems.length > max ? newItems.slice(1) : newItems;
}
function addToStart(items, item, max = 0) {
  const newItems = [item, ...items];
  return max && newItems.length > max ? newItems.slice(0, -1) : newItems;
}
var skipToken = Symbol();
function ensureQueryFn(options, fetchOptions) {
  if (true) {
    if (options.queryFn === skipToken) {
      console.error(`Attempted to invoke queryFn when set to skipToken. This is likely a configuration error. Query hash: '${options.queryHash}'`);
    }
  }
  if (!options.queryFn && fetchOptions?.initialPromise) {
    return () => fetchOptions.initialPromise;
  }
  if (!options.queryFn || options.queryFn === skipToken) {
    return () => Promise.reject(new Error(`Missing queryFn: '${options.queryHash}'`));
  }
  return options.queryFn;
}
function shouldThrowError(throwOnError, params) {
  if (typeof throwOnError === "function") {
    return throwOnError(...params);
  }
  return !!throwOnError;
}

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/notifyManager.js
var defaultScheduler = systemSetTimeoutZero;
function createNotifyManager() {
  let queue = [];
  let transactions = 0;
  let notifyFn = (callback) => {
    callback();
  };
  let batchNotifyFn = (callback) => {
    callback();
  };
  let scheduleFn = defaultScheduler;
  const schedule = (callback) => {
    if (transactions) {
      queue.push(callback);
    } else {
      scheduleFn(() => {
        notifyFn(callback);
      });
    }
  };
  const flush = () => {
    const originalQueue = queue;
    queue = [];
    if (originalQueue.length) {
      scheduleFn(() => {
        batchNotifyFn(() => {
          originalQueue.forEach((callback) => {
            notifyFn(callback);
          });
        });
      });
    }
  };
  return {
    batch: (callback) => {
      let result;
      transactions++;
      try {
        result = callback();
      } finally {
        transactions--;
        if (!transactions) {
          flush();
        }
      }
      return result;
    },
    batchCalls: (callback) => {
      return (...args) => {
        schedule(() => {
          callback(...args);
        });
      };
    },
    schedule,
    setNotifyFunction: (fn) => {
      notifyFn = fn;
    },
    setBatchNotifyFunction: (fn) => {
      batchNotifyFn = fn;
    },
    setScheduler: (fn) => {
      scheduleFn = fn;
    }
  };
}
var notifyManager = createNotifyManager();

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/subscribable.js
var Subscribable = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set;
    this.subscribe = this.subscribe.bind(this);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    this.onSubscribe();
    return () => {
      this.listeners.delete(listener);
      this.onUnsubscribe();
    };
  }
  hasListeners() {
    return this.listeners.size > 0;
  }
  onSubscribe() {}
  onUnsubscribe() {}
};

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/focusManager.js
var FocusManager = class extends Subscribable {
  #focused;
  #cleanup;
  #setup;
  constructor() {
    super();
    this.#setup = (onFocus) => {
      if (!isServer && window.addEventListener) {
        const listener = () => onFocus();
        window.addEventListener("visibilitychange", listener, false);
        return () => {
          window.removeEventListener("visibilitychange", listener);
        };
      }
      return;
    };
  }
  onSubscribe() {
    if (!this.#cleanup) {
      this.setEventListener(this.#setup);
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.#cleanup?.();
      this.#cleanup = undefined;
    }
  }
  setEventListener(setup) {
    this.#setup = setup;
    this.#cleanup?.();
    this.#cleanup = setup((focused) => {
      if (typeof focused === "boolean") {
        this.setFocused(focused);
      } else {
        this.onFocus();
      }
    });
  }
  setFocused(focused) {
    const changed = this.#focused !== focused;
    if (changed) {
      this.#focused = focused;
      this.onFocus();
    }
  }
  onFocus() {
    const isFocused = this.isFocused();
    this.listeners.forEach((listener) => {
      listener(isFocused);
    });
  }
  isFocused() {
    if (typeof this.#focused === "boolean") {
      return this.#focused;
    }
    return globalThis.document?.visibilityState !== "hidden";
  }
};
var focusManager = new FocusManager;

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/onlineManager.js
var OnlineManager = class extends Subscribable {
  #online = true;
  #cleanup;
  #setup;
  constructor() {
    super();
    this.#setup = (onOnline) => {
      if (!isServer && window.addEventListener) {
        const onlineListener = () => onOnline(true);
        const offlineListener = () => onOnline(false);
        window.addEventListener("online", onlineListener, false);
        window.addEventListener("offline", offlineListener, false);
        return () => {
          window.removeEventListener("online", onlineListener);
          window.removeEventListener("offline", offlineListener);
        };
      }
      return;
    };
  }
  onSubscribe() {
    if (!this.#cleanup) {
      this.setEventListener(this.#setup);
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.#cleanup?.();
      this.#cleanup = undefined;
    }
  }
  setEventListener(setup) {
    this.#setup = setup;
    this.#cleanup?.();
    this.#cleanup = setup(this.setOnline.bind(this));
  }
  setOnline(online) {
    const changed = this.#online !== online;
    if (changed) {
      this.#online = online;
      this.listeners.forEach((listener) => {
        listener(online);
      });
    }
  }
  isOnline() {
    return this.#online;
  }
};
var onlineManager = new OnlineManager;

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/thenable.js
function pendingThenable() {
  let resolve;
  let reject;
  const thenable = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  thenable.status = "pending";
  thenable.catch(() => {});
  function finalize(data) {
    Object.assign(thenable, data);
    delete thenable.resolve;
    delete thenable.reject;
  }
  thenable.resolve = (value) => {
    finalize({
      status: "fulfilled",
      value
    });
    resolve(value);
  };
  thenable.reject = (reason) => {
    finalize({
      status: "rejected",
      reason
    });
    reject(reason);
  };
  return thenable;
}

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/retryer.js
function defaultRetryDelay(failureCount) {
  return Math.min(1000 * 2 ** failureCount, 30000);
}
function canFetch(networkMode) {
  return (networkMode ?? "online") === "online" ? onlineManager.isOnline() : true;
}
var CancelledError = class extends Error {
  constructor(options) {
    super("CancelledError");
    this.revert = options?.revert;
    this.silent = options?.silent;
  }
};
function createRetryer(config) {
  let isRetryCancelled = false;
  let failureCount = 0;
  let continueFn;
  const thenable = pendingThenable();
  const isResolved = () => thenable.status !== "pending";
  const cancel = (cancelOptions) => {
    if (!isResolved()) {
      const error = new CancelledError(cancelOptions);
      reject(error);
      config.onCancel?.(error);
    }
  };
  const cancelRetry = () => {
    isRetryCancelled = true;
  };
  const continueRetry = () => {
    isRetryCancelled = false;
  };
  const canContinue = () => focusManager.isFocused() && (config.networkMode === "always" || onlineManager.isOnline()) && config.canRun();
  const canStart = () => canFetch(config.networkMode) && config.canRun();
  const resolve = (value) => {
    if (!isResolved()) {
      continueFn?.();
      thenable.resolve(value);
    }
  };
  const reject = (value) => {
    if (!isResolved()) {
      continueFn?.();
      thenable.reject(value);
    }
  };
  const pause = () => {
    return new Promise((continueResolve) => {
      continueFn = (value) => {
        if (isResolved() || canContinue()) {
          continueResolve(value);
        }
      };
      config.onPause?.();
    }).then(() => {
      continueFn = undefined;
      if (!isResolved()) {
        config.onContinue?.();
      }
    });
  };
  const run = () => {
    if (isResolved()) {
      return;
    }
    let promiseOrValue;
    const initialPromise = failureCount === 0 ? config.initialPromise : undefined;
    try {
      promiseOrValue = initialPromise ?? config.fn();
    } catch (error) {
      promiseOrValue = Promise.reject(error);
    }
    Promise.resolve(promiseOrValue).then(resolve).catch((error) => {
      if (isResolved()) {
        return;
      }
      const retry = config.retry ?? (isServer ? 0 : 3);
      const retryDelay = config.retryDelay ?? defaultRetryDelay;
      const delay = typeof retryDelay === "function" ? retryDelay(failureCount, error) : retryDelay;
      const shouldRetry = retry === true || typeof retry === "number" && failureCount < retry || typeof retry === "function" && retry(failureCount, error);
      if (isRetryCancelled || !shouldRetry) {
        reject(error);
        return;
      }
      failureCount++;
      config.onFail?.(failureCount, error);
      sleep(delay).then(() => {
        return canContinue() ? undefined : pause();
      }).then(() => {
        if (isRetryCancelled) {
          reject(error);
        } else {
          run();
        }
      });
    });
  };
  return {
    promise: thenable,
    status: () => thenable.status,
    cancel,
    continue: () => {
      continueFn?.();
      return thenable;
    },
    cancelRetry,
    continueRetry,
    canStart,
    start: () => {
      if (canStart()) {
        run();
      } else {
        pause().then(run);
      }
      return thenable;
    }
  };
}

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/removable.js
var Removable = class {
  #gcTimeout;
  destroy() {
    this.clearGcTimeout();
  }
  scheduleGc() {
    this.clearGcTimeout();
    if (isValidTimeout(this.gcTime)) {
      this.#gcTimeout = timeoutManager.setTimeout(() => {
        this.optionalRemove();
      }, this.gcTime);
    }
  }
  updateGcTime(newGcTime) {
    this.gcTime = Math.max(this.gcTime || 0, newGcTime ?? (isServer ? Infinity : 5 * 60 * 1000));
  }
  clearGcTimeout() {
    if (this.#gcTimeout) {
      timeoutManager.clearTimeout(this.#gcTimeout);
      this.#gcTimeout = undefined;
    }
  }
};

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/query.js
var Query = class extends Removable {
  #initialState;
  #revertState;
  #cache;
  #client;
  #retryer;
  #defaultOptions;
  #abortSignalConsumed;
  constructor(config) {
    super();
    this.#abortSignalConsumed = false;
    this.#defaultOptions = config.defaultOptions;
    this.setOptions(config.options);
    this.observers = [];
    this.#client = config.client;
    this.#cache = this.#client.getQueryCache();
    this.queryKey = config.queryKey;
    this.queryHash = config.queryHash;
    this.#initialState = getDefaultState(this.options);
    this.state = config.state ?? this.#initialState;
    this.scheduleGc();
  }
  get meta() {
    return this.options.meta;
  }
  get promise() {
    return this.#retryer?.promise;
  }
  setOptions(options) {
    this.options = { ...this.#defaultOptions, ...options };
    this.updateGcTime(this.options.gcTime);
    if (this.state && this.state.data === undefined) {
      const defaultState = getDefaultState(this.options);
      if (defaultState.data !== undefined) {
        this.setState(successState(defaultState.data, defaultState.dataUpdatedAt));
        this.#initialState = defaultState;
      }
    }
  }
  optionalRemove() {
    if (!this.observers.length && this.state.fetchStatus === "idle") {
      this.#cache.remove(this);
    }
  }
  setData(newData, options) {
    const data = replaceData(this.state.data, newData, this.options);
    this.#dispatch({
      data,
      type: "success",
      dataUpdatedAt: options?.updatedAt,
      manual: options?.manual
    });
    return data;
  }
  setState(state, setStateOptions) {
    this.#dispatch({ type: "setState", state, setStateOptions });
  }
  cancel(options) {
    const promise = this.#retryer?.promise;
    this.#retryer?.cancel(options);
    return promise ? promise.then(noop).catch(noop) : Promise.resolve();
  }
  destroy() {
    super.destroy();
    this.cancel({ silent: true });
  }
  reset() {
    this.destroy();
    this.setState(this.#initialState);
  }
  isActive() {
    return this.observers.some((observer) => resolveEnabled(observer.options.enabled, this) !== false);
  }
  isDisabled() {
    if (this.getObserversCount() > 0) {
      return !this.isActive();
    }
    return this.options.queryFn === skipToken || this.state.dataUpdateCount + this.state.errorUpdateCount === 0;
  }
  isStatic() {
    if (this.getObserversCount() > 0) {
      return this.observers.some((observer) => resolveStaleTime(observer.options.staleTime, this) === "static");
    }
    return false;
  }
  isStale() {
    if (this.getObserversCount() > 0) {
      return this.observers.some((observer) => observer.getCurrentResult().isStale);
    }
    return this.state.data === undefined || this.state.isInvalidated;
  }
  isStaleByTime(staleTime = 0) {
    if (this.state.data === undefined) {
      return true;
    }
    if (staleTime === "static") {
      return false;
    }
    if (this.state.isInvalidated) {
      return true;
    }
    return !timeUntilStale(this.state.dataUpdatedAt, staleTime);
  }
  onFocus() {
    const observer = this.observers.find((x) => x.shouldFetchOnWindowFocus());
    observer?.refetch({ cancelRefetch: false });
    this.#retryer?.continue();
  }
  onOnline() {
    const observer = this.observers.find((x) => x.shouldFetchOnReconnect());
    observer?.refetch({ cancelRefetch: false });
    this.#retryer?.continue();
  }
  addObserver(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      this.clearGcTimeout();
      this.#cache.notify({ type: "observerAdded", query: this, observer });
    }
  }
  removeObserver(observer) {
    if (this.observers.includes(observer)) {
      this.observers = this.observers.filter((x) => x !== observer);
      if (!this.observers.length) {
        if (this.#retryer) {
          if (this.#abortSignalConsumed) {
            this.#retryer.cancel({ revert: true });
          } else {
            this.#retryer.cancelRetry();
          }
        }
        this.scheduleGc();
      }
      this.#cache.notify({ type: "observerRemoved", query: this, observer });
    }
  }
  getObserversCount() {
    return this.observers.length;
  }
  invalidate() {
    if (!this.state.isInvalidated) {
      this.#dispatch({ type: "invalidate" });
    }
  }
  async fetch(options, fetchOptions) {
    if (this.state.fetchStatus !== "idle" && this.#retryer?.status() !== "rejected") {
      if (this.state.data !== undefined && fetchOptions?.cancelRefetch) {
        this.cancel({ silent: true });
      } else if (this.#retryer) {
        this.#retryer.continueRetry();
        return this.#retryer.promise;
      }
    }
    if (options) {
      this.setOptions(options);
    }
    if (!this.options.queryFn) {
      const observer = this.observers.find((x) => x.options.queryFn);
      if (observer) {
        this.setOptions(observer.options);
      }
    }
    if (true) {
      if (!Array.isArray(this.options.queryKey)) {
        console.error(`As of v4, queryKey needs to be an Array. If you are using a string like 'repoData', please change it to an Array, e.g. ['repoData']`);
      }
    }
    const abortController = new AbortController;
    const addSignalProperty = (object) => {
      Object.defineProperty(object, "signal", {
        enumerable: true,
        get: () => {
          this.#abortSignalConsumed = true;
          return abortController.signal;
        }
      });
    };
    const fetchFn = () => {
      const queryFn = ensureQueryFn(this.options, fetchOptions);
      const createQueryFnContext = () => {
        const queryFnContext2 = {
          client: this.#client,
          queryKey: this.queryKey,
          meta: this.meta
        };
        addSignalProperty(queryFnContext2);
        return queryFnContext2;
      };
      const queryFnContext = createQueryFnContext();
      this.#abortSignalConsumed = false;
      if (this.options.persister) {
        return this.options.persister(queryFn, queryFnContext, this);
      }
      return queryFn(queryFnContext);
    };
    const createFetchContext = () => {
      const context2 = {
        fetchOptions,
        options: this.options,
        queryKey: this.queryKey,
        client: this.#client,
        state: this.state,
        fetchFn
      };
      addSignalProperty(context2);
      return context2;
    };
    const context = createFetchContext();
    this.options.behavior?.onFetch(context, this);
    this.#revertState = this.state;
    if (this.state.fetchStatus === "idle" || this.state.fetchMeta !== context.fetchOptions?.meta) {
      this.#dispatch({ type: "fetch", meta: context.fetchOptions?.meta });
    }
    this.#retryer = createRetryer({
      initialPromise: fetchOptions?.initialPromise,
      fn: context.fetchFn,
      onCancel: (error) => {
        if (error instanceof CancelledError && error.revert) {
          this.setState({
            ...this.#revertState,
            fetchStatus: "idle"
          });
        }
        abortController.abort();
      },
      onFail: (failureCount, error) => {
        this.#dispatch({ type: "failed", failureCount, error });
      },
      onPause: () => {
        this.#dispatch({ type: "pause" });
      },
      onContinue: () => {
        this.#dispatch({ type: "continue" });
      },
      retry: context.options.retry,
      retryDelay: context.options.retryDelay,
      networkMode: context.options.networkMode,
      canRun: () => true
    });
    try {
      const data = await this.#retryer.start();
      if (data === undefined) {
        if (true) {
          console.error(`Query data cannot be undefined. Please make sure to return a value other than undefined from your query function. Affected query key: ${this.queryHash}`);
        }
        throw new Error(`${this.queryHash} data is undefined`);
      }
      this.setData(data);
      this.#cache.config.onSuccess?.(data, this);
      this.#cache.config.onSettled?.(data, this.state.error, this);
      return data;
    } catch (error) {
      if (error instanceof CancelledError) {
        if (error.silent) {
          return this.#retryer.promise;
        } else if (error.revert) {
          if (this.state.data === undefined) {
            throw error;
          }
          return this.state.data;
        }
      }
      this.#dispatch({
        type: "error",
        error
      });
      this.#cache.config.onError?.(error, this);
      this.#cache.config.onSettled?.(this.state.data, error, this);
      throw error;
    } finally {
      this.scheduleGc();
    }
  }
  #dispatch(action) {
    const reducer = (state) => {
      switch (action.type) {
        case "failed":
          return {
            ...state,
            fetchFailureCount: action.failureCount,
            fetchFailureReason: action.error
          };
        case "pause":
          return {
            ...state,
            fetchStatus: "paused"
          };
        case "continue":
          return {
            ...state,
            fetchStatus: "fetching"
          };
        case "fetch":
          return {
            ...state,
            ...fetchState(state.data, this.options),
            fetchMeta: action.meta ?? null
          };
        case "success":
          const newState = {
            ...state,
            ...successState(action.data, action.dataUpdatedAt),
            dataUpdateCount: state.dataUpdateCount + 1,
            ...!action.manual && {
              fetchStatus: "idle",
              fetchFailureCount: 0,
              fetchFailureReason: null
            }
          };
          this.#revertState = action.manual ? newState : undefined;
          return newState;
        case "error":
          const error = action.error;
          return {
            ...state,
            error,
            errorUpdateCount: state.errorUpdateCount + 1,
            errorUpdatedAt: Date.now(),
            fetchFailureCount: state.fetchFailureCount + 1,
            fetchFailureReason: error,
            fetchStatus: "idle",
            status: "error"
          };
        case "invalidate":
          return {
            ...state,
            isInvalidated: true
          };
        case "setState":
          return {
            ...state,
            ...action.state
          };
      }
    };
    this.state = reducer(this.state);
    notifyManager.batch(() => {
      this.observers.forEach((observer) => {
        observer.onQueryUpdate();
      });
      this.#cache.notify({ query: this, type: "updated", action });
    });
  }
};
function fetchState(data, options) {
  return {
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchStatus: canFetch(options.networkMode) ? "fetching" : "paused",
    ...data === undefined && {
      error: null,
      status: "pending"
    }
  };
}
function successState(data, dataUpdatedAt) {
  return {
    data,
    dataUpdatedAt: dataUpdatedAt ?? Date.now(),
    error: null,
    isInvalidated: false,
    status: "success"
  };
}
function getDefaultState(options) {
  const data = typeof options.initialData === "function" ? options.initialData() : options.initialData;
  const hasData = data !== undefined;
  const initialDataUpdatedAt = hasData ? typeof options.initialDataUpdatedAt === "function" ? options.initialDataUpdatedAt() : options.initialDataUpdatedAt : 0;
  return {
    data,
    dataUpdateCount: 0,
    dataUpdatedAt: hasData ? initialDataUpdatedAt ?? Date.now() : 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: false,
    status: hasData ? "success" : "pending",
    fetchStatus: "idle"
  };
}

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/queryCache.js
var QueryCache = class extends Subscribable {
  constructor(config = {}) {
    super();
    this.config = config;
    this.#queries = /* @__PURE__ */ new Map;
  }
  #queries;
  build(client, options, state) {
    const queryKey = options.queryKey;
    const queryHash = options.queryHash ?? hashQueryKeyByOptions(queryKey, options);
    let query = this.get(queryHash);
    if (!query) {
      query = new Query({
        client,
        queryKey,
        queryHash,
        options: client.defaultQueryOptions(options),
        state,
        defaultOptions: client.getQueryDefaults(queryKey)
      });
      this.add(query);
    }
    return query;
  }
  add(query) {
    if (!this.#queries.has(query.queryHash)) {
      this.#queries.set(query.queryHash, query);
      this.notify({
        type: "added",
        query
      });
    }
  }
  remove(query) {
    const queryInMap = this.#queries.get(query.queryHash);
    if (queryInMap) {
      query.destroy();
      if (queryInMap === query) {
        this.#queries.delete(query.queryHash);
      }
      this.notify({ type: "removed", query });
    }
  }
  clear() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        this.remove(query);
      });
    });
  }
  get(queryHash) {
    return this.#queries.get(queryHash);
  }
  getAll() {
    return [...this.#queries.values()];
  }
  find(filters) {
    const defaultedFilters = { exact: true, ...filters };
    return this.getAll().find((query) => matchQuery(defaultedFilters, query));
  }
  findAll(filters = {}) {
    const queries = this.getAll();
    return Object.keys(filters).length > 0 ? queries.filter((query) => matchQuery(filters, query)) : queries;
  }
  notify(event) {
    notifyManager.batch(() => {
      this.listeners.forEach((listener) => {
        listener(event);
      });
    });
  }
  onFocus() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        query.onFocus();
      });
    });
  }
  onOnline() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        query.onOnline();
      });
    });
  }
};

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/mutation.js
var Mutation = class extends Removable {
  #client;
  #observers;
  #mutationCache;
  #retryer;
  constructor(config) {
    super();
    this.#client = config.client;
    this.mutationId = config.mutationId;
    this.#mutationCache = config.mutationCache;
    this.#observers = [];
    this.state = config.state || getDefaultState2();
    this.setOptions(config.options);
    this.scheduleGc();
  }
  setOptions(options) {
    this.options = options;
    this.updateGcTime(this.options.gcTime);
  }
  get meta() {
    return this.options.meta;
  }
  addObserver(observer) {
    if (!this.#observers.includes(observer)) {
      this.#observers.push(observer);
      this.clearGcTimeout();
      this.#mutationCache.notify({
        type: "observerAdded",
        mutation: this,
        observer
      });
    }
  }
  removeObserver(observer) {
    this.#observers = this.#observers.filter((x) => x !== observer);
    this.scheduleGc();
    this.#mutationCache.notify({
      type: "observerRemoved",
      mutation: this,
      observer
    });
  }
  optionalRemove() {
    if (!this.#observers.length) {
      if (this.state.status === "pending") {
        this.scheduleGc();
      } else {
        this.#mutationCache.remove(this);
      }
    }
  }
  continue() {
    return this.#retryer?.continue() ?? this.execute(this.state.variables);
  }
  async execute(variables) {
    const onContinue = () => {
      this.#dispatch({ type: "continue" });
    };
    const mutationFnContext = {
      client: this.#client,
      meta: this.options.meta,
      mutationKey: this.options.mutationKey
    };
    this.#retryer = createRetryer({
      fn: () => {
        if (!this.options.mutationFn) {
          return Promise.reject(new Error("No mutationFn found"));
        }
        return this.options.mutationFn(variables, mutationFnContext);
      },
      onFail: (failureCount, error) => {
        this.#dispatch({ type: "failed", failureCount, error });
      },
      onPause: () => {
        this.#dispatch({ type: "pause" });
      },
      onContinue,
      retry: this.options.retry ?? 0,
      retryDelay: this.options.retryDelay,
      networkMode: this.options.networkMode,
      canRun: () => this.#mutationCache.canRun(this)
    });
    const restored = this.state.status === "pending";
    const isPaused = !this.#retryer.canStart();
    try {
      if (restored) {
        onContinue();
      } else {
        this.#dispatch({ type: "pending", variables, isPaused });
        await this.#mutationCache.config.onMutate?.(variables, this, mutationFnContext);
        const context = await this.options.onMutate?.(variables, mutationFnContext);
        if (context !== this.state.context) {
          this.#dispatch({
            type: "pending",
            context,
            variables,
            isPaused
          });
        }
      }
      const data = await this.#retryer.start();
      await this.#mutationCache.config.onSuccess?.(data, variables, this.state.context, this, mutationFnContext);
      await this.options.onSuccess?.(data, variables, this.state.context, mutationFnContext);
      await this.#mutationCache.config.onSettled?.(data, null, this.state.variables, this.state.context, this, mutationFnContext);
      await this.options.onSettled?.(data, null, variables, this.state.context, mutationFnContext);
      this.#dispatch({ type: "success", data });
      return data;
    } catch (error) {
      try {
        await this.#mutationCache.config.onError?.(error, variables, this.state.context, this, mutationFnContext);
        await this.options.onError?.(error, variables, this.state.context, mutationFnContext);
        await this.#mutationCache.config.onSettled?.(undefined, error, this.state.variables, this.state.context, this, mutationFnContext);
        await this.options.onSettled?.(undefined, error, variables, this.state.context, mutationFnContext);
        throw error;
      } finally {
        this.#dispatch({ type: "error", error });
      }
    } finally {
      this.#mutationCache.runNext(this);
    }
  }
  #dispatch(action) {
    const reducer = (state) => {
      switch (action.type) {
        case "failed":
          return {
            ...state,
            failureCount: action.failureCount,
            failureReason: action.error
          };
        case "pause":
          return {
            ...state,
            isPaused: true
          };
        case "continue":
          return {
            ...state,
            isPaused: false
          };
        case "pending":
          return {
            ...state,
            context: action.context,
            data: undefined,
            failureCount: 0,
            failureReason: null,
            error: null,
            isPaused: action.isPaused,
            status: "pending",
            variables: action.variables,
            submittedAt: Date.now()
          };
        case "success":
          return {
            ...state,
            data: action.data,
            failureCount: 0,
            failureReason: null,
            error: null,
            status: "success",
            isPaused: false
          };
        case "error":
          return {
            ...state,
            data: undefined,
            error: action.error,
            failureCount: state.failureCount + 1,
            failureReason: action.error,
            isPaused: false,
            status: "error"
          };
      }
    };
    this.state = reducer(this.state);
    notifyManager.batch(() => {
      this.#observers.forEach((observer) => {
        observer.onMutationUpdate(action);
      });
      this.#mutationCache.notify({
        mutation: this,
        type: "updated",
        action
      });
    });
  }
};
function getDefaultState2() {
  return {
    context: undefined,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    status: "idle",
    variables: undefined,
    submittedAt: 0
  };
}

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/mutationCache.js
var MutationCache = class extends Subscribable {
  constructor(config = {}) {
    super();
    this.config = config;
    this.#mutations = /* @__PURE__ */ new Set;
    this.#scopes = /* @__PURE__ */ new Map;
    this.#mutationId = 0;
  }
  #mutations;
  #scopes;
  #mutationId;
  build(client, options, state) {
    const mutation = new Mutation({
      client,
      mutationCache: this,
      mutationId: ++this.#mutationId,
      options: client.defaultMutationOptions(options),
      state
    });
    this.add(mutation);
    return mutation;
  }
  add(mutation) {
    this.#mutations.add(mutation);
    const scope = scopeFor(mutation);
    if (typeof scope === "string") {
      const scopedMutations = this.#scopes.get(scope);
      if (scopedMutations) {
        scopedMutations.push(mutation);
      } else {
        this.#scopes.set(scope, [mutation]);
      }
    }
    this.notify({ type: "added", mutation });
  }
  remove(mutation) {
    if (this.#mutations.delete(mutation)) {
      const scope = scopeFor(mutation);
      if (typeof scope === "string") {
        const scopedMutations = this.#scopes.get(scope);
        if (scopedMutations) {
          if (scopedMutations.length > 1) {
            const index = scopedMutations.indexOf(mutation);
            if (index !== -1) {
              scopedMutations.splice(index, 1);
            }
          } else if (scopedMutations[0] === mutation) {
            this.#scopes.delete(scope);
          }
        }
      }
    }
    this.notify({ type: "removed", mutation });
  }
  canRun(mutation) {
    const scope = scopeFor(mutation);
    if (typeof scope === "string") {
      const mutationsWithSameScope = this.#scopes.get(scope);
      const firstPendingMutation = mutationsWithSameScope?.find((m) => m.state.status === "pending");
      return !firstPendingMutation || firstPendingMutation === mutation;
    } else {
      return true;
    }
  }
  runNext(mutation) {
    const scope = scopeFor(mutation);
    if (typeof scope === "string") {
      const foundMutation = this.#scopes.get(scope)?.find((m) => m !== mutation && m.state.isPaused);
      return foundMutation?.continue() ?? Promise.resolve();
    } else {
      return Promise.resolve();
    }
  }
  clear() {
    notifyManager.batch(() => {
      this.#mutations.forEach((mutation) => {
        this.notify({ type: "removed", mutation });
      });
      this.#mutations.clear();
      this.#scopes.clear();
    });
  }
  getAll() {
    return Array.from(this.#mutations);
  }
  find(filters) {
    const defaultedFilters = { exact: true, ...filters };
    return this.getAll().find((mutation) => matchMutation(defaultedFilters, mutation));
  }
  findAll(filters = {}) {
    return this.getAll().filter((mutation) => matchMutation(filters, mutation));
  }
  notify(event) {
    notifyManager.batch(() => {
      this.listeners.forEach((listener) => {
        listener(event);
      });
    });
  }
  resumePausedMutations() {
    const pausedMutations = this.getAll().filter((x) => x.state.isPaused);
    return notifyManager.batch(() => Promise.all(pausedMutations.map((mutation) => mutation.continue().catch(noop))));
  }
};
function scopeFor(mutation) {
  return mutation.options.scope?.id;
}

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/infiniteQueryBehavior.js
function infiniteQueryBehavior(pages) {
  return {
    onFetch: (context, query) => {
      const options = context.options;
      const direction = context.fetchOptions?.meta?.fetchMore?.direction;
      const oldPages = context.state.data?.pages || [];
      const oldPageParams = context.state.data?.pageParams || [];
      let result = { pages: [], pageParams: [] };
      let currentPage = 0;
      const fetchFn = async () => {
        let cancelled = false;
        const addSignalProperty = (object) => {
          Object.defineProperty(object, "signal", {
            enumerable: true,
            get: () => {
              if (context.signal.aborted) {
                cancelled = true;
              } else {
                context.signal.addEventListener("abort", () => {
                  cancelled = true;
                });
              }
              return context.signal;
            }
          });
        };
        const queryFn = ensureQueryFn(context.options, context.fetchOptions);
        const fetchPage = async (data, param, previous) => {
          if (cancelled) {
            return Promise.reject();
          }
          if (param == null && data.pages.length) {
            return Promise.resolve(data);
          }
          const createQueryFnContext = () => {
            const queryFnContext2 = {
              client: context.client,
              queryKey: context.queryKey,
              pageParam: param,
              direction: previous ? "backward" : "forward",
              meta: context.options.meta
            };
            addSignalProperty(queryFnContext2);
            return queryFnContext2;
          };
          const queryFnContext = createQueryFnContext();
          const page = await queryFn(queryFnContext);
          const { maxPages } = context.options;
          const addTo = previous ? addToStart : addToEnd;
          return {
            pages: addTo(data.pages, page, maxPages),
            pageParams: addTo(data.pageParams, param, maxPages)
          };
        };
        if (direction && oldPages.length) {
          const previous = direction === "backward";
          const pageParamFn = previous ? getPreviousPageParam : getNextPageParam;
          const oldData = {
            pages: oldPages,
            pageParams: oldPageParams
          };
          const param = pageParamFn(options, oldData);
          result = await fetchPage(oldData, param, previous);
        } else {
          const remainingPages = pages ?? oldPages.length;
          do {
            const param = currentPage === 0 ? oldPageParams[0] ?? options.initialPageParam : getNextPageParam(options, result);
            if (currentPage > 0 && param == null) {
              break;
            }
            result = await fetchPage(result, param);
            currentPage++;
          } while (currentPage < remainingPages);
        }
        return result;
      };
      if (context.options.persister) {
        context.fetchFn = () => {
          return context.options.persister?.(fetchFn, {
            client: context.client,
            queryKey: context.queryKey,
            meta: context.options.meta,
            signal: context.signal
          }, query);
        };
      } else {
        context.fetchFn = fetchFn;
      }
    }
  };
}
function getNextPageParam(options, { pages, pageParams }) {
  const lastIndex = pages.length - 1;
  return pages.length > 0 ? options.getNextPageParam(pages[lastIndex], pages, pageParams[lastIndex], pageParams) : undefined;
}
function getPreviousPageParam(options, { pages, pageParams }) {
  return pages.length > 0 ? options.getPreviousPageParam?.(pages[0], pages, pageParams[0], pageParams) : undefined;
}

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/queryClient.js
var QueryClient = class {
  #queryCache;
  #mutationCache;
  #defaultOptions;
  #queryDefaults;
  #mutationDefaults;
  #mountCount;
  #unsubscribeFocus;
  #unsubscribeOnline;
  constructor(config = {}) {
    this.#queryCache = config.queryCache || new QueryCache;
    this.#mutationCache = config.mutationCache || new MutationCache;
    this.#defaultOptions = config.defaultOptions || {};
    this.#queryDefaults = /* @__PURE__ */ new Map;
    this.#mutationDefaults = /* @__PURE__ */ new Map;
    this.#mountCount = 0;
  }
  mount() {
    this.#mountCount++;
    if (this.#mountCount !== 1)
      return;
    this.#unsubscribeFocus = focusManager.subscribe(async (focused) => {
      if (focused) {
        await this.resumePausedMutations();
        this.#queryCache.onFocus();
      }
    });
    this.#unsubscribeOnline = onlineManager.subscribe(async (online) => {
      if (online) {
        await this.resumePausedMutations();
        this.#queryCache.onOnline();
      }
    });
  }
  unmount() {
    this.#mountCount--;
    if (this.#mountCount !== 0)
      return;
    this.#unsubscribeFocus?.();
    this.#unsubscribeFocus = undefined;
    this.#unsubscribeOnline?.();
    this.#unsubscribeOnline = undefined;
  }
  isFetching(filters) {
    return this.#queryCache.findAll({ ...filters, fetchStatus: "fetching" }).length;
  }
  isMutating(filters) {
    return this.#mutationCache.findAll({ ...filters, status: "pending" }).length;
  }
  getQueryData(queryKey) {
    const options = this.defaultQueryOptions({ queryKey });
    return this.#queryCache.get(options.queryHash)?.state.data;
  }
  ensureQueryData(options) {
    const defaultedOptions = this.defaultQueryOptions(options);
    const query = this.#queryCache.build(this, defaultedOptions);
    const cachedData = query.state.data;
    if (cachedData === undefined) {
      return this.fetchQuery(options);
    }
    if (options.revalidateIfStale && query.isStaleByTime(resolveStaleTime(defaultedOptions.staleTime, query))) {
      this.prefetchQuery(defaultedOptions);
    }
    return Promise.resolve(cachedData);
  }
  getQueriesData(filters) {
    return this.#queryCache.findAll(filters).map(({ queryKey, state }) => {
      const data = state.data;
      return [queryKey, data];
    });
  }
  setQueryData(queryKey, updater, options) {
    const defaultedOptions = this.defaultQueryOptions({ queryKey });
    const query = this.#queryCache.get(defaultedOptions.queryHash);
    const prevData = query?.state.data;
    const data = functionalUpdate(updater, prevData);
    if (data === undefined) {
      return;
    }
    return this.#queryCache.build(this, defaultedOptions).setData(data, { ...options, manual: true });
  }
  setQueriesData(filters, updater, options) {
    return notifyManager.batch(() => this.#queryCache.findAll(filters).map(({ queryKey }) => [
      queryKey,
      this.setQueryData(queryKey, updater, options)
    ]));
  }
  getQueryState(queryKey) {
    const options = this.defaultQueryOptions({ queryKey });
    return this.#queryCache.get(options.queryHash)?.state;
  }
  removeQueries(filters) {
    const queryCache = this.#queryCache;
    notifyManager.batch(() => {
      queryCache.findAll(filters).forEach((query) => {
        queryCache.remove(query);
      });
    });
  }
  resetQueries(filters, options) {
    const queryCache = this.#queryCache;
    return notifyManager.batch(() => {
      queryCache.findAll(filters).forEach((query) => {
        query.reset();
      });
      return this.refetchQueries({
        type: "active",
        ...filters
      }, options);
    });
  }
  cancelQueries(filters, cancelOptions = {}) {
    const defaultedCancelOptions = { revert: true, ...cancelOptions };
    const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).map((query) => query.cancel(defaultedCancelOptions)));
    return Promise.all(promises).then(noop).catch(noop);
  }
  invalidateQueries(filters, options = {}) {
    return notifyManager.batch(() => {
      this.#queryCache.findAll(filters).forEach((query) => {
        query.invalidate();
      });
      if (filters?.refetchType === "none") {
        return Promise.resolve();
      }
      return this.refetchQueries({
        ...filters,
        type: filters?.refetchType ?? filters?.type ?? "active"
      }, options);
    });
  }
  refetchQueries(filters, options = {}) {
    const fetchOptions = {
      ...options,
      cancelRefetch: options.cancelRefetch ?? true
    };
    const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).filter((query) => !query.isDisabled() && !query.isStatic()).map((query) => {
      let promise = query.fetch(undefined, fetchOptions);
      if (!fetchOptions.throwOnError) {
        promise = promise.catch(noop);
      }
      return query.state.fetchStatus === "paused" ? Promise.resolve() : promise;
    }));
    return Promise.all(promises).then(noop);
  }
  fetchQuery(options) {
    const defaultedOptions = this.defaultQueryOptions(options);
    if (defaultedOptions.retry === undefined) {
      defaultedOptions.retry = false;
    }
    const query = this.#queryCache.build(this, defaultedOptions);
    return query.isStaleByTime(resolveStaleTime(defaultedOptions.staleTime, query)) ? query.fetch(defaultedOptions) : Promise.resolve(query.state.data);
  }
  prefetchQuery(options) {
    return this.fetchQuery(options).then(noop).catch(noop);
  }
  fetchInfiniteQuery(options) {
    options.behavior = infiniteQueryBehavior(options.pages);
    return this.fetchQuery(options);
  }
  prefetchInfiniteQuery(options) {
    return this.fetchInfiniteQuery(options).then(noop).catch(noop);
  }
  ensureInfiniteQueryData(options) {
    options.behavior = infiniteQueryBehavior(options.pages);
    return this.ensureQueryData(options);
  }
  resumePausedMutations() {
    if (onlineManager.isOnline()) {
      return this.#mutationCache.resumePausedMutations();
    }
    return Promise.resolve();
  }
  getQueryCache() {
    return this.#queryCache;
  }
  getMutationCache() {
    return this.#mutationCache;
  }
  getDefaultOptions() {
    return this.#defaultOptions;
  }
  setDefaultOptions(options) {
    this.#defaultOptions = options;
  }
  setQueryDefaults(queryKey, options) {
    this.#queryDefaults.set(hashKey(queryKey), {
      queryKey,
      defaultOptions: options
    });
  }
  getQueryDefaults(queryKey) {
    const defaults = [...this.#queryDefaults.values()];
    const result = {};
    defaults.forEach((queryDefault) => {
      if (partialMatchKey(queryKey, queryDefault.queryKey)) {
        Object.assign(result, queryDefault.defaultOptions);
      }
    });
    return result;
  }
  setMutationDefaults(mutationKey, options) {
    this.#mutationDefaults.set(hashKey(mutationKey), {
      mutationKey,
      defaultOptions: options
    });
  }
  getMutationDefaults(mutationKey) {
    const defaults = [...this.#mutationDefaults.values()];
    const result = {};
    defaults.forEach((queryDefault) => {
      if (partialMatchKey(mutationKey, queryDefault.mutationKey)) {
        Object.assign(result, queryDefault.defaultOptions);
      }
    });
    return result;
  }
  defaultQueryOptions(options) {
    if (options._defaulted) {
      return options;
    }
    const defaultedOptions = {
      ...this.#defaultOptions.queries,
      ...this.getQueryDefaults(options.queryKey),
      ...options,
      _defaulted: true
    };
    if (!defaultedOptions.queryHash) {
      defaultedOptions.queryHash = hashQueryKeyByOptions(defaultedOptions.queryKey, defaultedOptions);
    }
    if (defaultedOptions.refetchOnReconnect === undefined) {
      defaultedOptions.refetchOnReconnect = defaultedOptions.networkMode !== "always";
    }
    if (defaultedOptions.throwOnError === undefined) {
      defaultedOptions.throwOnError = !!defaultedOptions.suspense;
    }
    if (!defaultedOptions.networkMode && defaultedOptions.persister) {
      defaultedOptions.networkMode = "offlineFirst";
    }
    if (defaultedOptions.queryFn === skipToken) {
      defaultedOptions.enabled = false;
    }
    return defaultedOptions;
  }
  defaultMutationOptions(options) {
    if (options?._defaulted) {
      return options;
    }
    return {
      ...this.#defaultOptions.mutations,
      ...options?.mutationKey && this.getMutationDefaults(options.mutationKey),
      ...options,
      _defaulted: true
    };
  }
  clear() {
    this.#queryCache.clear();
    this.#mutationCache.clear();
  }
};

// ../../../../node_modules/.bun/@tanstack+query-core@5.90.12/node_modules/@tanstack/query-core/build/modern/queryObserver.js
var QueryObserver = class extends Subscribable {
  constructor(client, options) {
    super();
    this.options = options;
    this.#client = client;
    this.#selectError = null;
    this.#currentThenable = pendingThenable();
    this.bindMethods();
    this.setOptions(options);
  }
  #client;
  #currentQuery = undefined;
  #currentQueryInitialState = undefined;
  #currentResult = undefined;
  #currentResultState;
  #currentResultOptions;
  #currentThenable;
  #selectError;
  #selectFn;
  #selectResult;
  #lastQueryWithDefinedData;
  #staleTimeoutId;
  #refetchIntervalId;
  #currentRefetchInterval;
  #trackedProps = /* @__PURE__ */ new Set;
  bindMethods() {
    this.refetch = this.refetch.bind(this);
  }
  onSubscribe() {
    if (this.listeners.size === 1) {
      this.#currentQuery.addObserver(this);
      if (shouldFetchOnMount(this.#currentQuery, this.options)) {
        this.#executeFetch();
      } else {
        this.updateResult();
      }
      this.#updateTimers();
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.destroy();
    }
  }
  shouldFetchOnReconnect() {
    return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnReconnect);
  }
  shouldFetchOnWindowFocus() {
    return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnWindowFocus);
  }
  destroy() {
    this.listeners = /* @__PURE__ */ new Set;
    this.#clearStaleTimeout();
    this.#clearRefetchInterval();
    this.#currentQuery.removeObserver(this);
  }
  setOptions(options) {
    const prevOptions = this.options;
    const prevQuery = this.#currentQuery;
    this.options = this.#client.defaultQueryOptions(options);
    if (this.options.enabled !== undefined && typeof this.options.enabled !== "boolean" && typeof this.options.enabled !== "function" && typeof resolveEnabled(this.options.enabled, this.#currentQuery) !== "boolean") {
      throw new Error("Expected enabled to be a boolean or a callback that returns a boolean");
    }
    this.#updateQuery();
    this.#currentQuery.setOptions(this.options);
    if (prevOptions._defaulted && !shallowEqualObjects(this.options, prevOptions)) {
      this.#client.getQueryCache().notify({
        type: "observerOptionsUpdated",
        query: this.#currentQuery,
        observer: this
      });
    }
    const mounted = this.hasListeners();
    if (mounted && shouldFetchOptionally(this.#currentQuery, prevQuery, this.options, prevOptions)) {
      this.#executeFetch();
    }
    this.updateResult();
    if (mounted && (this.#currentQuery !== prevQuery || resolveEnabled(this.options.enabled, this.#currentQuery) !== resolveEnabled(prevOptions.enabled, this.#currentQuery) || resolveStaleTime(this.options.staleTime, this.#currentQuery) !== resolveStaleTime(prevOptions.staleTime, this.#currentQuery))) {
      this.#updateStaleTimeout();
    }
    const nextRefetchInterval = this.#computeRefetchInterval();
    if (mounted && (this.#currentQuery !== prevQuery || resolveEnabled(this.options.enabled, this.#currentQuery) !== resolveEnabled(prevOptions.enabled, this.#currentQuery) || nextRefetchInterval !== this.#currentRefetchInterval)) {
      this.#updateRefetchInterval(nextRefetchInterval);
    }
  }
  getOptimisticResult(options) {
    const query = this.#client.getQueryCache().build(this.#client, options);
    const result = this.createResult(query, options);
    if (shouldAssignObserverCurrentProperties(this, result)) {
      this.#currentResult = result;
      this.#currentResultOptions = this.options;
      this.#currentResultState = this.#currentQuery.state;
    }
    return result;
  }
  getCurrentResult() {
    return this.#currentResult;
  }
  trackResult(result, onPropTracked) {
    return new Proxy(result, {
      get: (target, key) => {
        this.trackProp(key);
        onPropTracked?.(key);
        if (key === "promise") {
          this.trackProp("data");
          if (!this.options.experimental_prefetchInRender && this.#currentThenable.status === "pending") {
            this.#currentThenable.reject(new Error("experimental_prefetchInRender feature flag is not enabled"));
          }
        }
        return Reflect.get(target, key);
      }
    });
  }
  trackProp(key) {
    this.#trackedProps.add(key);
  }
  getCurrentQuery() {
    return this.#currentQuery;
  }
  refetch({ ...options } = {}) {
    return this.fetch({
      ...options
    });
  }
  fetchOptimistic(options) {
    const defaultedOptions = this.#client.defaultQueryOptions(options);
    const query = this.#client.getQueryCache().build(this.#client, defaultedOptions);
    return query.fetch().then(() => this.createResult(query, defaultedOptions));
  }
  fetch(fetchOptions) {
    return this.#executeFetch({
      ...fetchOptions,
      cancelRefetch: fetchOptions.cancelRefetch ?? true
    }).then(() => {
      this.updateResult();
      return this.#currentResult;
    });
  }
  #executeFetch(fetchOptions) {
    this.#updateQuery();
    let promise = this.#currentQuery.fetch(this.options, fetchOptions);
    if (!fetchOptions?.throwOnError) {
      promise = promise.catch(noop);
    }
    return promise;
  }
  #updateStaleTimeout() {
    this.#clearStaleTimeout();
    const staleTime = resolveStaleTime(this.options.staleTime, this.#currentQuery);
    if (isServer || this.#currentResult.isStale || !isValidTimeout(staleTime)) {
      return;
    }
    const time = timeUntilStale(this.#currentResult.dataUpdatedAt, staleTime);
    const timeout = time + 1;
    this.#staleTimeoutId = timeoutManager.setTimeout(() => {
      if (!this.#currentResult.isStale) {
        this.updateResult();
      }
    }, timeout);
  }
  #computeRefetchInterval() {
    return (typeof this.options.refetchInterval === "function" ? this.options.refetchInterval(this.#currentQuery) : this.options.refetchInterval) ?? false;
  }
  #updateRefetchInterval(nextInterval) {
    this.#clearRefetchInterval();
    this.#currentRefetchInterval = nextInterval;
    if (isServer || resolveEnabled(this.options.enabled, this.#currentQuery) === false || !isValidTimeout(this.#currentRefetchInterval) || this.#currentRefetchInterval === 0) {
      return;
    }
    this.#refetchIntervalId = timeoutManager.setInterval(() => {
      if (this.options.refetchIntervalInBackground || focusManager.isFocused()) {
        this.#executeFetch();
      }
    }, this.#currentRefetchInterval);
  }
  #updateTimers() {
    this.#updateStaleTimeout();
    this.#updateRefetchInterval(this.#computeRefetchInterval());
  }
  #clearStaleTimeout() {
    if (this.#staleTimeoutId) {
      timeoutManager.clearTimeout(this.#staleTimeoutId);
      this.#staleTimeoutId = undefined;
    }
  }
  #clearRefetchInterval() {
    if (this.#refetchIntervalId) {
      timeoutManager.clearInterval(this.#refetchIntervalId);
      this.#refetchIntervalId = undefined;
    }
  }
  createResult(query, options) {
    const prevQuery = this.#currentQuery;
    const prevOptions = this.options;
    const prevResult = this.#currentResult;
    const prevResultState = this.#currentResultState;
    const prevResultOptions = this.#currentResultOptions;
    const queryChange = query !== prevQuery;
    const queryInitialState = queryChange ? query.state : this.#currentQueryInitialState;
    const { state } = query;
    let newState = { ...state };
    let isPlaceholderData = false;
    let data;
    if (options._optimisticResults) {
      const mounted = this.hasListeners();
      const fetchOnMount = !mounted && shouldFetchOnMount(query, options);
      const fetchOptionally = mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions);
      if (fetchOnMount || fetchOptionally) {
        newState = {
          ...newState,
          ...fetchState(state.data, query.options)
        };
      }
      if (options._optimisticResults === "isRestoring") {
        newState.fetchStatus = "idle";
      }
    }
    let { error, errorUpdatedAt, status } = newState;
    data = newState.data;
    let skipSelect = false;
    if (options.placeholderData !== undefined && data === undefined && status === "pending") {
      let placeholderData;
      if (prevResult?.isPlaceholderData && options.placeholderData === prevResultOptions?.placeholderData) {
        placeholderData = prevResult.data;
        skipSelect = true;
      } else {
        placeholderData = typeof options.placeholderData === "function" ? options.placeholderData(this.#lastQueryWithDefinedData?.state.data, this.#lastQueryWithDefinedData) : options.placeholderData;
      }
      if (placeholderData !== undefined) {
        status = "success";
        data = replaceData(prevResult?.data, placeholderData, options);
        isPlaceholderData = true;
      }
    }
    if (options.select && data !== undefined && !skipSelect) {
      if (prevResult && data === prevResultState?.data && options.select === this.#selectFn) {
        data = this.#selectResult;
      } else {
        try {
          this.#selectFn = options.select;
          data = options.select(data);
          data = replaceData(prevResult?.data, data, options);
          this.#selectResult = data;
          this.#selectError = null;
        } catch (selectError) {
          this.#selectError = selectError;
        }
      }
    }
    if (this.#selectError) {
      error = this.#selectError;
      data = this.#selectResult;
      errorUpdatedAt = Date.now();
      status = "error";
    }
    const isFetching = newState.fetchStatus === "fetching";
    const isPending = status === "pending";
    const isError = status === "error";
    const isLoading = isPending && isFetching;
    const hasData = data !== undefined;
    const result = {
      status,
      fetchStatus: newState.fetchStatus,
      isPending,
      isSuccess: status === "success",
      isError,
      isInitialLoading: isLoading,
      isLoading,
      data,
      dataUpdatedAt: newState.dataUpdatedAt,
      error,
      errorUpdatedAt,
      failureCount: newState.fetchFailureCount,
      failureReason: newState.fetchFailureReason,
      errorUpdateCount: newState.errorUpdateCount,
      isFetched: newState.dataUpdateCount > 0 || newState.errorUpdateCount > 0,
      isFetchedAfterMount: newState.dataUpdateCount > queryInitialState.dataUpdateCount || newState.errorUpdateCount > queryInitialState.errorUpdateCount,
      isFetching,
      isRefetching: isFetching && !isPending,
      isLoadingError: isError && !hasData,
      isPaused: newState.fetchStatus === "paused",
      isPlaceholderData,
      isRefetchError: isError && hasData,
      isStale: isStale(query, options),
      refetch: this.refetch,
      promise: this.#currentThenable,
      isEnabled: resolveEnabled(options.enabled, query) !== false
    };
    const nextResult = result;
    if (this.options.experimental_prefetchInRender) {
      const finalizeThenableIfPossible = (thenable) => {
        if (nextResult.status === "error") {
          thenable.reject(nextResult.error);
        } else if (nextResult.data !== undefined) {
          thenable.resolve(nextResult.data);
        }
      };
      const recreateThenable = () => {
        const pending = this.#currentThenable = nextResult.promise = pendingThenable();
        finalizeThenableIfPossible(pending);
      };
      const prevThenable = this.#currentThenable;
      switch (prevThenable.status) {
        case "pending":
          if (query.queryHash === prevQuery.queryHash) {
            finalizeThenableIfPossible(prevThenable);
          }
          break;
        case "fulfilled":
          if (nextResult.status === "error" || nextResult.data !== prevThenable.value) {
            recreateThenable();
          }
          break;
        case "rejected":
          if (nextResult.status !== "error" || nextResult.error !== prevThenable.reason) {
            recreateThenable();
          }
          break;
      }
    }
    return nextResult;
  }
  updateResult() {
    const prevResult = this.#currentResult;
    const nextResult = this.createResult(this.#currentQuery, this.options);
    this.#currentResultState = this.#currentQuery.state;
    this.#currentResultOptions = this.options;
    if (this.#currentResultState.data !== undefined) {
      this.#lastQueryWithDefinedData = this.#currentQuery;
    }
    if (shallowEqualObjects(nextResult, prevResult)) {
      return;
    }
    this.#currentResult = nextResult;
    const shouldNotifyListeners = () => {
      if (!prevResult) {
        return true;
      }
      const { notifyOnChangeProps } = this.options;
      const notifyOnChangePropsValue = typeof notifyOnChangeProps === "function" ? notifyOnChangeProps() : notifyOnChangeProps;
      if (notifyOnChangePropsValue === "all" || !notifyOnChangePropsValue && !this.#trackedProps.size) {
        return true;
      }
      const includedProps = new Set(notifyOnChangePropsValue ?? this.#trackedProps);
      if (this.options.throwOnError) {
        includedProps.add("error");
      }
      return Object.keys(this.#currentResult).some((key) => {
        const typedKey = key;
        const changed = this.#currentResult[typedKey] !== prevResult[typedKey];
        return changed && includedProps.has(typedKey);
      });
    };
    this.#notify({ listeners: shouldNotifyListeners() });
  }
  #updateQuery() {
    const query = this.#client.getQueryCache().build(this.#client, this.options);
    if (query === this.#currentQuery) {
      return;
    }
    const prevQuery = this.#currentQuery;
    this.#currentQuery = query;
    this.#currentQueryInitialState = query.state;
    if (this.hasListeners()) {
      prevQuery?.removeObserver(this);
      query.addObserver(this);
    }
  }
  onQueryUpdate() {
    this.updateResult();
    if (this.hasListeners()) {
      this.#updateTimers();
    }
  }
  #notify(notifyOptions) {
    notifyManager.batch(() => {
      if (notifyOptions.listeners) {
        this.listeners.forEach((listener) => {
          listener(this.#currentResult);
        });
      }
      this.#client.getQueryCache().notify({
        query: this.#currentQuery,
        type: "observerResultsUpdated"
      });
    });
  }
};
function shouldLoadOnMount(query, options) {
  return resolveEnabled(options.enabled, query) !== false && query.state.data === undefined && !(query.state.status === "error" && options.retryOnMount === false);
}
function shouldFetchOnMount(query, options) {
  return shouldLoadOnMount(query, options) || query.state.data !== undefined && shouldFetchOn(query, options, options.refetchOnMount);
}
function shouldFetchOn(query, options, field) {
  if (resolveEnabled(options.enabled, query) !== false && resolveStaleTime(options.staleTime, query) !== "static") {
    const value = typeof field === "function" ? field(query) : field;
    return value === "always" || value !== false && isStale(query, options);
  }
  return false;
}
function shouldFetchOptionally(query, prevQuery, options, prevOptions) {
  return (query !== prevQuery || resolveEnabled(prevOptions.enabled, query) === false) && (!options.suspense || query.state.status !== "error") && isStale(query, options);
}
function isStale(query, options) {
  return resolveEnabled(options.enabled, query) !== false && query.isStaleByTime(resolveStaleTime(options.staleTime, query));
}
function shouldAssignObserverCurrentProperties(observer, optimisticResult) {
  if (!shallowEqualObjects(observer.getCurrentResult(), optimisticResult)) {
    return true;
  }
  return false;
}
// ../../../../node_modules/.bun/@tanstack+react-query@5.90.12+83d5fd7b249dbeef/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js
var React = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
"use client";
var QueryClientContext = React.createContext(undefined);
var useQueryClient = (queryClient) => {
  const client = React.useContext(QueryClientContext);
  if (queryClient) {
    return queryClient;
  }
  if (!client) {
    throw new Error("No QueryClient set, use QueryClientProvider to set one");
  }
  return client;
};
var QueryClientProvider = ({
  client,
  children
}) => {
  React.useEffect(() => {
    client.mount();
    return () => {
      client.unmount();
    };
  }, [client]);
  return /* @__PURE__ */ import_jsx_runtime.jsx(QueryClientContext.Provider, { value: client, children });
};
// ../../../../node_modules/.bun/@tanstack+react-query@5.90.12+83d5fd7b249dbeef/node_modules/@tanstack/react-query/build/modern/IsRestoringProvider.js
var React2 = __toESM(require_react(), 1);
"use client";
var IsRestoringContext = React2.createContext(false);
var useIsRestoring = () => React2.useContext(IsRestoringContext);
var IsRestoringProvider = IsRestoringContext.Provider;

// ../../../../node_modules/.bun/@tanstack+react-query@5.90.12+83d5fd7b249dbeef/node_modules/@tanstack/react-query/build/modern/QueryErrorResetBoundary.js
var React3 = __toESM(require_react(), 1);
var import_jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
"use client";
function createValue() {
  let isReset = false;
  return {
    clearReset: () => {
      isReset = false;
    },
    reset: () => {
      isReset = true;
    },
    isReset: () => {
      return isReset;
    }
  };
}
var QueryErrorResetBoundaryContext = React3.createContext(createValue());
var useQueryErrorResetBoundary = () => React3.useContext(QueryErrorResetBoundaryContext);

// ../../../../node_modules/.bun/@tanstack+react-query@5.90.12+83d5fd7b249dbeef/node_modules/@tanstack/react-query/build/modern/errorBoundaryUtils.js
var React4 = __toESM(require_react(), 1);
"use client";
var ensurePreventErrorBoundaryRetry = (options, errorResetBoundary) => {
  if (options.suspense || options.throwOnError || options.experimental_prefetchInRender) {
    if (!errorResetBoundary.isReset()) {
      options.retryOnMount = false;
    }
  }
};
var useClearResetErrorBoundary = (errorResetBoundary) => {
  React4.useEffect(() => {
    errorResetBoundary.clearReset();
  }, [errorResetBoundary]);
};
var getHasError = ({
  result,
  errorResetBoundary,
  throwOnError,
  query,
  suspense
}) => {
  return result.isError && !errorResetBoundary.isReset() && !result.isFetching && query && (suspense && result.data === undefined || shouldThrowError(throwOnError, [result.error, query]));
};

// ../../../../node_modules/.bun/@tanstack+react-query@5.90.12+83d5fd7b249dbeef/node_modules/@tanstack/react-query/build/modern/suspense.js
var ensureSuspenseTimers = (defaultedOptions) => {
  if (defaultedOptions.suspense) {
    const MIN_SUSPENSE_TIME_MS = 1000;
    const clamp = (value) => value === "static" ? value : Math.max(value ?? MIN_SUSPENSE_TIME_MS, MIN_SUSPENSE_TIME_MS);
    const originalStaleTime = defaultedOptions.staleTime;
    defaultedOptions.staleTime = typeof originalStaleTime === "function" ? (...args) => clamp(originalStaleTime(...args)) : clamp(originalStaleTime);
    if (typeof defaultedOptions.gcTime === "number") {
      defaultedOptions.gcTime = Math.max(defaultedOptions.gcTime, MIN_SUSPENSE_TIME_MS);
    }
  }
};
var willFetch = (result, isRestoring) => result.isLoading && result.isFetching && !isRestoring;
var shouldSuspend = (defaultedOptions, result) => defaultedOptions?.suspense && result.isPending;
var fetchOptimistic = (defaultedOptions, observer, errorResetBoundary) => observer.fetchOptimistic(defaultedOptions).catch(() => {
  errorResetBoundary.clearReset();
});

// ../../../../node_modules/.bun/@tanstack+react-query@5.90.12+83d5fd7b249dbeef/node_modules/@tanstack/react-query/build/modern/useBaseQuery.js
var React5 = __toESM(require_react(), 1);
"use client";
function useBaseQuery(options, Observer, queryClient) {
  if (true) {
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new Error('Bad argument type. Starting with v5, only the "Object" form is allowed when calling query related functions. Please use the error stack to find the culprit call. More info here: https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5#supports-a-single-signature-one-object');
    }
  }
  const isRestoring = useIsRestoring();
  const errorResetBoundary = useQueryErrorResetBoundary();
  const client = useQueryClient(queryClient);
  const defaultedOptions = client.defaultQueryOptions(options);
  client.getDefaultOptions().queries?._experimental_beforeQuery?.(defaultedOptions);
  if (true) {
    if (!defaultedOptions.queryFn) {
      console.error(`[${defaultedOptions.queryHash}]: No queryFn was passed as an option, and no default queryFn was found. The queryFn parameter is only optional when using a default queryFn. More info here: https://tanstack.com/query/latest/docs/framework/react/guides/default-query-function`);
    }
  }
  defaultedOptions._optimisticResults = isRestoring ? "isRestoring" : "optimistic";
  ensureSuspenseTimers(defaultedOptions);
  ensurePreventErrorBoundaryRetry(defaultedOptions, errorResetBoundary);
  useClearResetErrorBoundary(errorResetBoundary);
  const isNewCacheEntry = !client.getQueryCache().get(defaultedOptions.queryHash);
  const [observer] = React5.useState(() => new Observer(client, defaultedOptions));
  const result = observer.getOptimisticResult(defaultedOptions);
  const shouldSubscribe = !isRestoring && options.subscribed !== false;
  React5.useSyncExternalStore(React5.useCallback((onStoreChange) => {
    const unsubscribe = shouldSubscribe ? observer.subscribe(notifyManager.batchCalls(onStoreChange)) : noop;
    observer.updateResult();
    return unsubscribe;
  }, [observer, shouldSubscribe]), () => observer.getCurrentResult(), () => observer.getCurrentResult());
  React5.useEffect(() => {
    observer.setOptions(defaultedOptions);
  }, [defaultedOptions, observer]);
  if (shouldSuspend(defaultedOptions, result)) {
    throw fetchOptimistic(defaultedOptions, observer, errorResetBoundary);
  }
  if (getHasError({
    result,
    errorResetBoundary,
    throwOnError: defaultedOptions.throwOnError,
    query: client.getQueryCache().get(defaultedOptions.queryHash),
    suspense: defaultedOptions.suspense
  })) {
    throw result.error;
  }
  client.getDefaultOptions().queries?._experimental_afterQuery?.(defaultedOptions, result);
  if (defaultedOptions.experimental_prefetchInRender && !isServer && willFetch(result, isRestoring)) {
    const promise = isNewCacheEntry ? fetchOptimistic(defaultedOptions, observer, errorResetBoundary) : client.getQueryCache().get(defaultedOptions.queryHash)?.promise;
    promise?.catch(noop).finally(() => {
      observer.updateResult();
    });
  }
  return !defaultedOptions.notifyOnChangeProps ? observer.trackResult(result) : result;
}

// ../../../../node_modules/.bun/@tanstack+react-query@5.90.12+83d5fd7b249dbeef/node_modules/@tanstack/react-query/build/modern/useQuery.js
"use client";
function useQuery(options, queryClient) {
  return useBaseQuery(options, QueryObserver, queryClient);
}

export { require_react, require_react_dom, QueryClient, require_jsx_runtime, QueryClientProvider, useQuery, require_jsx_dev_runtime };

//# debugId=393576F51042C28664756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vcmVhY3RAMTkuMi4zL25vZGVfbW9kdWxlcy9yZWFjdC9janMvcmVhY3QuZGV2ZWxvcG1lbnQuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vcmVhY3RAMTkuMi4zL25vZGVfbW9kdWxlcy9yZWFjdC9pbmRleC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9yZWFjdEAxOS4yLjMvbm9kZV9tb2R1bGVzL3JlYWN0L2Nqcy9yZWFjdC1qc3gtcnVudGltZS5kZXZlbG9wbWVudC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9yZWFjdEAxOS4yLjMvbm9kZV9tb2R1bGVzL3JlYWN0L2pzeC1ydW50aW1lLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3JlYWN0QDE5LjIuMy9ub2RlX21vZHVsZXMvcmVhY3QvY2pzL3JlYWN0LWpzeC1kZXYtcnVudGltZS5kZXZlbG9wbWVudC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9yZWFjdEAxOS4yLjMvbm9kZV9tb2R1bGVzL3JlYWN0L2pzeC1kZXYtcnVudGltZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9yZWFjdC1kb21AMTkuMi4zKzgzZDVmZDdiMjQ5ZGJlZWYvbm9kZV9tb2R1bGVzL3JlYWN0LWRvbS9janMvcmVhY3QtZG9tLmRldmVsb3BtZW50LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3JlYWN0LWRvbUAxOS4yLjMrODNkNWZkN2IyNDlkYmVlZi9ub2RlX21vZHVsZXMvcmVhY3QtZG9tL2luZGV4LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0B0YW5zdGFjaytxdWVyeS1jb3JlQDUuOTAuMTIvbm9kZV9tb2R1bGVzL0B0YW5zdGFjay9xdWVyeS1jb3JlL2J1aWxkL21vZGVybi90aW1lb3V0TWFuYWdlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdGFuc3RhY2srcXVlcnktY29yZUA1LjkwLjEyL25vZGVfbW9kdWxlcy9AdGFuc3RhY2svcXVlcnktY29yZS9idWlsZC9tb2Rlcm4vdXRpbHMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRhbnN0YWNrK3F1ZXJ5LWNvcmVANS45MC4xMi9ub2RlX21vZHVsZXMvQHRhbnN0YWNrL3F1ZXJ5LWNvcmUvYnVpbGQvbW9kZXJuL25vdGlmeU1hbmFnZXIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRhbnN0YWNrK3F1ZXJ5LWNvcmVANS45MC4xMi9ub2RlX21vZHVsZXMvQHRhbnN0YWNrL3F1ZXJ5LWNvcmUvYnVpbGQvbW9kZXJuL3N1YnNjcmliYWJsZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdGFuc3RhY2srcXVlcnktY29yZUA1LjkwLjEyL25vZGVfbW9kdWxlcy9AdGFuc3RhY2svcXVlcnktY29yZS9idWlsZC9tb2Rlcm4vZm9jdXNNYW5hZ2VyLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0B0YW5zdGFjaytxdWVyeS1jb3JlQDUuOTAuMTIvbm9kZV9tb2R1bGVzL0B0YW5zdGFjay9xdWVyeS1jb3JlL2J1aWxkL21vZGVybi9vbmxpbmVNYW5hZ2VyLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0B0YW5zdGFjaytxdWVyeS1jb3JlQDUuOTAuMTIvbm9kZV9tb2R1bGVzL0B0YW5zdGFjay9xdWVyeS1jb3JlL2J1aWxkL21vZGVybi90aGVuYWJsZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdGFuc3RhY2srcXVlcnktY29yZUA1LjkwLjEyL25vZGVfbW9kdWxlcy9AdGFuc3RhY2svcXVlcnktY29yZS9idWlsZC9tb2Rlcm4vcmV0cnllci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdGFuc3RhY2srcXVlcnktY29yZUA1LjkwLjEyL25vZGVfbW9kdWxlcy9AdGFuc3RhY2svcXVlcnktY29yZS9idWlsZC9tb2Rlcm4vcmVtb3ZhYmxlLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0B0YW5zdGFjaytxdWVyeS1jb3JlQDUuOTAuMTIvbm9kZV9tb2R1bGVzL0B0YW5zdGFjay9xdWVyeS1jb3JlL2J1aWxkL21vZGVybi9xdWVyeS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdGFuc3RhY2srcXVlcnktY29yZUA1LjkwLjEyL25vZGVfbW9kdWxlcy9AdGFuc3RhY2svcXVlcnktY29yZS9idWlsZC9tb2Rlcm4vcXVlcnlDYWNoZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdGFuc3RhY2srcXVlcnktY29yZUA1LjkwLjEyL25vZGVfbW9kdWxlcy9AdGFuc3RhY2svcXVlcnktY29yZS9idWlsZC9tb2Rlcm4vbXV0YXRpb24uanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRhbnN0YWNrK3F1ZXJ5LWNvcmVANS45MC4xMi9ub2RlX21vZHVsZXMvQHRhbnN0YWNrL3F1ZXJ5LWNvcmUvYnVpbGQvbW9kZXJuL211dGF0aW9uQ2FjaGUuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRhbnN0YWNrK3F1ZXJ5LWNvcmVANS45MC4xMi9ub2RlX21vZHVsZXMvQHRhbnN0YWNrL3F1ZXJ5LWNvcmUvYnVpbGQvbW9kZXJuL2luZmluaXRlUXVlcnlCZWhhdmlvci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdGFuc3RhY2srcXVlcnktY29yZUA1LjkwLjEyL25vZGVfbW9kdWxlcy9AdGFuc3RhY2svcXVlcnktY29yZS9idWlsZC9tb2Rlcm4vcXVlcnlDbGllbnQuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRhbnN0YWNrK3F1ZXJ5LWNvcmVANS45MC4xMi9ub2RlX21vZHVsZXMvQHRhbnN0YWNrL3F1ZXJ5LWNvcmUvYnVpbGQvbW9kZXJuL3F1ZXJ5T2JzZXJ2ZXIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRhbnN0YWNrK3JlYWN0LXF1ZXJ5QDUuOTAuMTIrODNkNWZkN2IyNDlkYmVlZi9ub2RlX21vZHVsZXMvQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5L2J1aWxkL21vZGVybi9RdWVyeUNsaWVudFByb3ZpZGVyLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0B0YW5zdGFjaytyZWFjdC1xdWVyeUA1LjkwLjEyKzgzZDVmZDdiMjQ5ZGJlZWYvbm9kZV9tb2R1bGVzL0B0YW5zdGFjay9yZWFjdC1xdWVyeS9idWlsZC9tb2Rlcm4vSXNSZXN0b3JpbmdQcm92aWRlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdGFuc3RhY2srcmVhY3QtcXVlcnlANS45MC4xMis4M2Q1ZmQ3YjI0OWRiZWVmL25vZGVfbW9kdWxlcy9AdGFuc3RhY2svcmVhY3QtcXVlcnkvYnVpbGQvbW9kZXJuL1F1ZXJ5RXJyb3JSZXNldEJvdW5kYXJ5LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0B0YW5zdGFjaytyZWFjdC1xdWVyeUA1LjkwLjEyKzgzZDVmZDdiMjQ5ZGJlZWYvbm9kZV9tb2R1bGVzL0B0YW5zdGFjay9yZWFjdC1xdWVyeS9idWlsZC9tb2Rlcm4vZXJyb3JCb3VuZGFyeVV0aWxzLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0B0YW5zdGFjaytyZWFjdC1xdWVyeUA1LjkwLjEyKzgzZDVmZDdiMjQ5ZGJlZWYvbm9kZV9tb2R1bGVzL0B0YW5zdGFjay9yZWFjdC1xdWVyeS9idWlsZC9tb2Rlcm4vc3VzcGVuc2UuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRhbnN0YWNrK3JlYWN0LXF1ZXJ5QDUuOTAuMTIrODNkNWZkN2IyNDlkYmVlZi9ub2RlX21vZHVsZXMvQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5L2J1aWxkL21vZGVybi91c2VCYXNlUXVlcnkuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRhbnN0YWNrK3JlYWN0LXF1ZXJ5QDUuOTAuMTIrODNkNWZkN2IyNDlkYmVlZi9ub2RlX21vZHVsZXMvQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5L2J1aWxkL21vZGVybi91c2VRdWVyeS5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICIvKipcbiAqIEBsaWNlbnNlIFJlYWN0XG4gKiByZWFjdC5kZXZlbG9wbWVudC5qc1xuICpcbiAqIENvcHlyaWdodCAoYykgTWV0YSBQbGF0Zm9ybXMsIEluYy4gYW5kIGFmZmlsaWF0ZXMuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuXG4gKi9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cInByb2R1Y3Rpb25cIiAhPT0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgJiZcbiAgKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBkZWZpbmVEZXByZWNhdGlvbldhcm5pbmcobWV0aG9kTmFtZSwgaW5mbykge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbXBvbmVudC5wcm90b3R5cGUsIG1ldGhvZE5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgXCIlcyguLi4pIGlzIGRlcHJlY2F0ZWQgaW4gcGxhaW4gSmF2YVNjcmlwdCBSZWFjdCBjbGFzc2VzLiAlc1wiLFxuICAgICAgICAgICAgaW5mb1swXSxcbiAgICAgICAgICAgIGluZm9bMV1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0SXRlcmF0b3JGbihtYXliZUl0ZXJhYmxlKSB7XG4gICAgICBpZiAobnVsbCA9PT0gbWF5YmVJdGVyYWJsZSB8fCBcIm9iamVjdFwiICE9PSB0eXBlb2YgbWF5YmVJdGVyYWJsZSlcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICBtYXliZUl0ZXJhYmxlID1cbiAgICAgICAgKE1BWUJFX0lURVJBVE9SX1NZTUJPTCAmJiBtYXliZUl0ZXJhYmxlW01BWUJFX0lURVJBVE9SX1NZTUJPTF0pIHx8XG4gICAgICAgIG1heWJlSXRlcmFibGVbXCJAQGl0ZXJhdG9yXCJdO1xuICAgICAgcmV0dXJuIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIG1heWJlSXRlcmFibGUgPyBtYXliZUl0ZXJhYmxlIDogbnVsbDtcbiAgICB9XG4gICAgZnVuY3Rpb24gd2Fybk5vb3AocHVibGljSW5zdGFuY2UsIGNhbGxlck5hbWUpIHtcbiAgICAgIHB1YmxpY0luc3RhbmNlID1cbiAgICAgICAgKChwdWJsaWNJbnN0YW5jZSA9IHB1YmxpY0luc3RhbmNlLmNvbnN0cnVjdG9yKSAmJlxuICAgICAgICAgIChwdWJsaWNJbnN0YW5jZS5kaXNwbGF5TmFtZSB8fCBwdWJsaWNJbnN0YW5jZS5uYW1lKSkgfHxcbiAgICAgICAgXCJSZWFjdENsYXNzXCI7XG4gICAgICB2YXIgd2FybmluZ0tleSA9IHB1YmxpY0luc3RhbmNlICsgXCIuXCIgKyBjYWxsZXJOYW1lO1xuICAgICAgZGlkV2FyblN0YXRlVXBkYXRlRm9yVW5tb3VudGVkQ29tcG9uZW50W3dhcm5pbmdLZXldIHx8XG4gICAgICAgIChjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiQ2FuJ3QgY2FsbCAlcyBvbiBhIGNvbXBvbmVudCB0aGF0IGlzIG5vdCB5ZXQgbW91bnRlZC4gVGhpcyBpcyBhIG5vLW9wLCBidXQgaXQgbWlnaHQgaW5kaWNhdGUgYSBidWcgaW4geW91ciBhcHBsaWNhdGlvbi4gSW5zdGVhZCwgYXNzaWduIHRvIGB0aGlzLnN0YXRlYCBkaXJlY3RseSBvciBkZWZpbmUgYSBgc3RhdGUgPSB7fTtgIGNsYXNzIHByb3BlcnR5IHdpdGggdGhlIGRlc2lyZWQgc3RhdGUgaW4gdGhlICVzIGNvbXBvbmVudC5cIixcbiAgICAgICAgICBjYWxsZXJOYW1lLFxuICAgICAgICAgIHB1YmxpY0luc3RhbmNlXG4gICAgICAgICksXG4gICAgICAgIChkaWRXYXJuU3RhdGVVcGRhdGVGb3JVbm1vdW50ZWRDb21wb25lbnRbd2FybmluZ0tleV0gPSAhMCkpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBDb21wb25lbnQocHJvcHMsIGNvbnRleHQsIHVwZGF0ZXIpIHtcbiAgICAgIHRoaXMucHJvcHMgPSBwcm9wcztcbiAgICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICB0aGlzLnJlZnMgPSBlbXB0eU9iamVjdDtcbiAgICAgIHRoaXMudXBkYXRlciA9IHVwZGF0ZXIgfHwgUmVhY3ROb29wVXBkYXRlUXVldWU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIENvbXBvbmVudER1bW15KCkge31cbiAgICBmdW5jdGlvbiBQdXJlQ29tcG9uZW50KHByb3BzLCBjb250ZXh0LCB1cGRhdGVyKSB7XG4gICAgICB0aGlzLnByb3BzID0gcHJvcHM7XG4gICAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgICAgdGhpcy5yZWZzID0gZW1wdHlPYmplY3Q7XG4gICAgICB0aGlzLnVwZGF0ZXIgPSB1cGRhdGVyIHx8IFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBub29wKCkge31cbiAgICBmdW5jdGlvbiB0ZXN0U3RyaW5nQ29lcmNpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiBcIlwiICsgdmFsdWU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNoZWNrS2V5U3RyaW5nQ29lcmNpb24odmFsdWUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRlc3RTdHJpbmdDb2VyY2lvbih2YWx1ZSk7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQgPSAhMTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gITA7XG4gICAgICB9XG4gICAgICBpZiAoSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0KSB7XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9IGNvbnNvbGU7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX3RlbXBfY29uc3QgPSBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQuZXJyb3I7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQkanNjb21wJDAgPVxuICAgICAgICAgIChcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBTeW1ib2wgJiZcbiAgICAgICAgICAgIFN5bWJvbC50b1N0cmluZ1RhZyAmJlxuICAgICAgICAgICAgdmFsdWVbU3ltYm9sLnRvU3RyaW5nVGFnXSkgfHxcbiAgICAgICAgICB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lIHx8XG4gICAgICAgICAgXCJPYmplY3RcIjtcbiAgICAgICAgSlNDb21waWxlcl90ZW1wX2NvbnN0LmNhbGwoXG4gICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0LFxuICAgICAgICAgIFwiVGhlIHByb3ZpZGVkIGtleSBpcyBhbiB1bnN1cHBvcnRlZCB0eXBlICVzLiBUaGlzIHZhbHVlIG11c3QgYmUgY29lcmNlZCB0byBhIHN0cmluZyBiZWZvcmUgdXNpbmcgaXQgaGVyZS5cIixcbiAgICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQkanNjb21wJDBcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHRlc3RTdHJpbmdDb2VyY2lvbih2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0eXBlKSB7XG4gICAgICBpZiAobnVsbCA9PSB0eXBlKSByZXR1cm4gbnVsbDtcbiAgICAgIGlmIChcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiB0eXBlKVxuICAgICAgICByZXR1cm4gdHlwZS4kJHR5cGVvZiA9PT0gUkVBQ1RfQ0xJRU5UX1JFRkVSRU5DRVxuICAgICAgICAgID8gbnVsbFxuICAgICAgICAgIDogdHlwZS5kaXNwbGF5TmFtZSB8fCB0eXBlLm5hbWUgfHwgbnVsbDtcbiAgICAgIGlmIChcInN0cmluZ1wiID09PSB0eXBlb2YgdHlwZSkgcmV0dXJuIHR5cGU7XG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBSRUFDVF9GUkFHTUVOVF9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIkZyYWdtZW50XCI7XG4gICAgICAgIGNhc2UgUkVBQ1RfUFJPRklMRVJfVFlQRTpcbiAgICAgICAgICByZXR1cm4gXCJQcm9maWxlclwiO1xuICAgICAgICBjYXNlIFJFQUNUX1NUUklDVF9NT0RFX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiU3RyaWN0TW9kZVwiO1xuICAgICAgICBjYXNlIFJFQUNUX1NVU1BFTlNFX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiU3VzcGVuc2VcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVVNQRU5TRV9MSVNUX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiU3VzcGVuc2VMaXN0XCI7XG4gICAgICAgIGNhc2UgUkVBQ1RfQUNUSVZJVFlfVFlQRTpcbiAgICAgICAgICByZXR1cm4gXCJBY3Rpdml0eVwiO1xuICAgICAgfVxuICAgICAgaWYgKFwib2JqZWN0XCIgPT09IHR5cGVvZiB0eXBlKVxuICAgICAgICBzd2l0Y2ggKFxuICAgICAgICAgIChcIm51bWJlclwiID09PSB0eXBlb2YgdHlwZS50YWcgJiZcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwiUmVjZWl2ZWQgYW4gdW5leHBlY3RlZCBvYmplY3QgaW4gZ2V0Q29tcG9uZW50TmFtZUZyb21UeXBlKCkuIFRoaXMgaXMgbGlrZWx5IGEgYnVnIGluIFJlYWN0LiBQbGVhc2UgZmlsZSBhbiBpc3N1ZS5cIlxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB0eXBlLiQkdHlwZW9mKVxuICAgICAgICApIHtcbiAgICAgICAgICBjYXNlIFJFQUNUX1BPUlRBTF9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIFwiUG9ydGFsXCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9DT05URVhUX1RZUEU6XG4gICAgICAgICAgICByZXR1cm4gdHlwZS5kaXNwbGF5TmFtZSB8fCBcIkNvbnRleHRcIjtcbiAgICAgICAgICBjYXNlIFJFQUNUX0NPTlNVTUVSX1RZUEU6XG4gICAgICAgICAgICByZXR1cm4gKHR5cGUuX2NvbnRleHQuZGlzcGxheU5hbWUgfHwgXCJDb250ZXh0XCIpICsgXCIuQ29uc3VtZXJcIjtcbiAgICAgICAgICBjYXNlIFJFQUNUX0ZPUldBUkRfUkVGX1RZUEU6XG4gICAgICAgICAgICB2YXIgaW5uZXJUeXBlID0gdHlwZS5yZW5kZXI7XG4gICAgICAgICAgICB0eXBlID0gdHlwZS5kaXNwbGF5TmFtZTtcbiAgICAgICAgICAgIHR5cGUgfHxcbiAgICAgICAgICAgICAgKCh0eXBlID0gaW5uZXJUeXBlLmRpc3BsYXlOYW1lIHx8IGlubmVyVHlwZS5uYW1lIHx8IFwiXCIpLFxuICAgICAgICAgICAgICAodHlwZSA9IFwiXCIgIT09IHR5cGUgPyBcIkZvcndhcmRSZWYoXCIgKyB0eXBlICsgXCIpXCIgOiBcIkZvcndhcmRSZWZcIikpO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGU7XG4gICAgICAgICAgY2FzZSBSRUFDVF9NRU1PX1RZUEU6XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAoaW5uZXJUeXBlID0gdHlwZS5kaXNwbGF5TmFtZSB8fCBudWxsKSxcbiAgICAgICAgICAgICAgbnVsbCAhPT0gaW5uZXJUeXBlXG4gICAgICAgICAgICAgICAgPyBpbm5lclR5cGVcbiAgICAgICAgICAgICAgICA6IGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0eXBlLnR5cGUpIHx8IFwiTWVtb1wiXG4gICAgICAgICAgICApO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfTEFaWV9UWVBFOlxuICAgICAgICAgICAgaW5uZXJUeXBlID0gdHlwZS5fcGF5bG9hZDtcbiAgICAgICAgICAgIHR5cGUgPSB0eXBlLl9pbml0O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0eXBlKGlubmVyVHlwZSkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoeCkge31cbiAgICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldFRhc2tOYW1lKHR5cGUpIHtcbiAgICAgIGlmICh0eXBlID09PSBSRUFDVF9GUkFHTUVOVF9UWVBFKSByZXR1cm4gXCI8PlwiO1xuICAgICAgaWYgKFxuICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2YgdHlwZSAmJlxuICAgICAgICBudWxsICE9PSB0eXBlICYmXG4gICAgICAgIHR5cGUuJCR0eXBlb2YgPT09IFJFQUNUX0xBWllfVFlQRVxuICAgICAgKVxuICAgICAgICByZXR1cm4gXCI8Li4uPlwiO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIG5hbWUgPSBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSk7XG4gICAgICAgIHJldHVybiBuYW1lID8gXCI8XCIgKyBuYW1lICsgXCI+XCIgOiBcIjwuLi4+XCI7XG4gICAgICB9IGNhdGNoICh4KSB7XG4gICAgICAgIHJldHVybiBcIjwuLi4+XCI7XG4gICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldE93bmVyKCkge1xuICAgICAgdmFyIGRpc3BhdGNoZXIgPSBSZWFjdFNoYXJlZEludGVybmFscy5BO1xuICAgICAgcmV0dXJuIG51bGwgPT09IGRpc3BhdGNoZXIgPyBudWxsIDogZGlzcGF0Y2hlci5nZXRPd25lcigpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBVbmtub3duT3duZXIoKSB7XG4gICAgICByZXR1cm4gRXJyb3IoXCJyZWFjdC1zdGFjay10b3AtZnJhbWVcIik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGhhc1ZhbGlkS2V5KGNvbmZpZykge1xuICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBcImtleVwiKSkge1xuICAgICAgICB2YXIgZ2V0dGVyID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihjb25maWcsIFwia2V5XCIpLmdldDtcbiAgICAgICAgaWYgKGdldHRlciAmJiBnZXR0ZXIuaXNSZWFjdFdhcm5pbmcpIHJldHVybiAhMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2b2lkIDAgIT09IGNvbmZpZy5rZXk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRlZmluZUtleVByb3BXYXJuaW5nR2V0dGVyKHByb3BzLCBkaXNwbGF5TmFtZSkge1xuICAgICAgZnVuY3Rpb24gd2FybkFib3V0QWNjZXNzaW5nS2V5KCkge1xuICAgICAgICBzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93biB8fFxuICAgICAgICAgICgoc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd24gPSAhMCksXG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIFwiJXM6IGBrZXlgIGlzIG5vdCBhIHByb3AuIFRyeWluZyB0byBhY2Nlc3MgaXQgd2lsbCByZXN1bHQgaW4gYHVuZGVmaW5lZGAgYmVpbmcgcmV0dXJuZWQuIElmIHlvdSBuZWVkIHRvIGFjY2VzcyB0aGUgc2FtZSB2YWx1ZSB3aXRoaW4gdGhlIGNoaWxkIGNvbXBvbmVudCwgeW91IHNob3VsZCBwYXNzIGl0IGFzIGEgZGlmZmVyZW50IHByb3AuIChodHRwczovL3JlYWN0LmRldi9saW5rL3NwZWNpYWwtcHJvcHMpXCIsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZVxuICAgICAgICAgICkpO1xuICAgICAgfVxuICAgICAgd2FybkFib3V0QWNjZXNzaW5nS2V5LmlzUmVhY3RXYXJuaW5nID0gITA7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsIFwia2V5XCIsIHtcbiAgICAgICAgZ2V0OiB3YXJuQWJvdXRBY2Nlc3NpbmdLZXksXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITBcbiAgICAgIH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlbGVtZW50UmVmR2V0dGVyV2l0aERlcHJlY2F0aW9uV2FybmluZygpIHtcbiAgICAgIHZhciBjb21wb25lbnROYW1lID0gZ2V0Q29tcG9uZW50TmFtZUZyb21UeXBlKHRoaXMudHlwZSk7XG4gICAgICBkaWRXYXJuQWJvdXRFbGVtZW50UmVmW2NvbXBvbmVudE5hbWVdIHx8XG4gICAgICAgICgoZGlkV2FybkFib3V0RWxlbWVudFJlZltjb21wb25lbnROYW1lXSA9ICEwKSxcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIkFjY2Vzc2luZyBlbGVtZW50LnJlZiB3YXMgcmVtb3ZlZCBpbiBSZWFjdCAxOS4gcmVmIGlzIG5vdyBhIHJlZ3VsYXIgcHJvcC4gSXQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIEpTWCBFbGVtZW50IHR5cGUgaW4gYSBmdXR1cmUgcmVsZWFzZS5cIlxuICAgICAgICApKTtcbiAgICAgIGNvbXBvbmVudE5hbWUgPSB0aGlzLnByb3BzLnJlZjtcbiAgICAgIHJldHVybiB2b2lkIDAgIT09IGNvbXBvbmVudE5hbWUgPyBjb21wb25lbnROYW1lIDogbnVsbDtcbiAgICB9XG4gICAgZnVuY3Rpb24gUmVhY3RFbGVtZW50KHR5cGUsIGtleSwgcHJvcHMsIG93bmVyLCBkZWJ1Z1N0YWNrLCBkZWJ1Z1Rhc2spIHtcbiAgICAgIHZhciByZWZQcm9wID0gcHJvcHMucmVmO1xuICAgICAgdHlwZSA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0VMRU1FTlRfVFlQRSxcbiAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgICAgX293bmVyOiBvd25lclxuICAgICAgfTtcbiAgICAgIG51bGwgIT09ICh2b2lkIDAgIT09IHJlZlByb3AgPyByZWZQcm9wIDogbnVsbClcbiAgICAgICAgPyBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJyZWZcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgICAgICBnZXQ6IGVsZW1lbnRSZWZHZXR0ZXJXaXRoRGVwcmVjYXRpb25XYXJuaW5nXG4gICAgICAgICAgfSlcbiAgICAgICAgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJyZWZcIiwgeyBlbnVtZXJhYmxlOiAhMSwgdmFsdWU6IG51bGwgfSk7XG4gICAgICB0eXBlLl9zdG9yZSA9IHt9O1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUuX3N0b3JlLCBcInZhbGlkYXRlZFwiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITEsXG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICB3cml0YWJsZTogITAsXG4gICAgICAgIHZhbHVlOiAwXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIl9kZWJ1Z0luZm9cIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogbnVsbFxuICAgICAgfSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJfZGVidWdTdGFja1wiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITEsXG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICB3cml0YWJsZTogITAsXG4gICAgICAgIHZhbHVlOiBkZWJ1Z1N0YWNrXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIl9kZWJ1Z1Rhc2tcIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogZGVidWdUYXNrXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5mcmVlemUgJiYgKE9iamVjdC5mcmVlemUodHlwZS5wcm9wcyksIE9iamVjdC5mcmVlemUodHlwZSkpO1xuICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNsb25lQW5kUmVwbGFjZUtleShvbGRFbGVtZW50LCBuZXdLZXkpIHtcbiAgICAgIG5ld0tleSA9IFJlYWN0RWxlbWVudChcbiAgICAgICAgb2xkRWxlbWVudC50eXBlLFxuICAgICAgICBuZXdLZXksXG4gICAgICAgIG9sZEVsZW1lbnQucHJvcHMsXG4gICAgICAgIG9sZEVsZW1lbnQuX293bmVyLFxuICAgICAgICBvbGRFbGVtZW50Ll9kZWJ1Z1N0YWNrLFxuICAgICAgICBvbGRFbGVtZW50Ll9kZWJ1Z1Rhc2tcbiAgICAgICk7XG4gICAgICBvbGRFbGVtZW50Ll9zdG9yZSAmJlxuICAgICAgICAobmV3S2V5Ll9zdG9yZS52YWxpZGF0ZWQgPSBvbGRFbGVtZW50Ll9zdG9yZS52YWxpZGF0ZWQpO1xuICAgICAgcmV0dXJuIG5ld0tleTtcbiAgICB9XG4gICAgZnVuY3Rpb24gdmFsaWRhdGVDaGlsZEtleXMobm9kZSkge1xuICAgICAgaXNWYWxpZEVsZW1lbnQobm9kZSlcbiAgICAgICAgPyBub2RlLl9zdG9yZSAmJiAobm9kZS5fc3RvcmUudmFsaWRhdGVkID0gMSlcbiAgICAgICAgOiBcIm9iamVjdFwiID09PSB0eXBlb2Ygbm9kZSAmJlxuICAgICAgICAgIG51bGwgIT09IG5vZGUgJiZcbiAgICAgICAgICBub2RlLiQkdHlwZW9mID09PSBSRUFDVF9MQVpZX1RZUEUgJiZcbiAgICAgICAgICAoXCJmdWxmaWxsZWRcIiA9PT0gbm9kZS5fcGF5bG9hZC5zdGF0dXNcbiAgICAgICAgICAgID8gaXNWYWxpZEVsZW1lbnQobm9kZS5fcGF5bG9hZC52YWx1ZSkgJiZcbiAgICAgICAgICAgICAgbm9kZS5fcGF5bG9hZC52YWx1ZS5fc3RvcmUgJiZcbiAgICAgICAgICAgICAgKG5vZGUuX3BheWxvYWQudmFsdWUuX3N0b3JlLnZhbGlkYXRlZCA9IDEpXG4gICAgICAgICAgICA6IG5vZGUuX3N0b3JlICYmIChub2RlLl9zdG9yZS52YWxpZGF0ZWQgPSAxKSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzVmFsaWRFbGVtZW50KG9iamVjdCkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIG9iamVjdCAmJlxuICAgICAgICBudWxsICE9PSBvYmplY3QgJiZcbiAgICAgICAgb2JqZWN0LiQkdHlwZW9mID09PSBSRUFDVF9FTEVNRU5UX1RZUEVcbiAgICAgICk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGVzY2FwZShrZXkpIHtcbiAgICAgIHZhciBlc2NhcGVyTG9va3VwID0geyBcIj1cIjogXCI9MFwiLCBcIjpcIjogXCI9MlwiIH07XG4gICAgICByZXR1cm4gKFxuICAgICAgICBcIiRcIiArXG4gICAgICAgIGtleS5yZXBsYWNlKC9bPTpdL2csIGZ1bmN0aW9uIChtYXRjaCkge1xuICAgICAgICAgIHJldHVybiBlc2NhcGVyTG9va3VwW21hdGNoXTtcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldEVsZW1lbnRLZXkoZWxlbWVudCwgaW5kZXgpIHtcbiAgICAgIHJldHVybiBcIm9iamVjdFwiID09PSB0eXBlb2YgZWxlbWVudCAmJlxuICAgICAgICBudWxsICE9PSBlbGVtZW50ICYmXG4gICAgICAgIG51bGwgIT0gZWxlbWVudC5rZXlcbiAgICAgICAgPyAoY2hlY2tLZXlTdHJpbmdDb2VyY2lvbihlbGVtZW50LmtleSksIGVzY2FwZShcIlwiICsgZWxlbWVudC5rZXkpKVxuICAgICAgICA6IGluZGV4LnRvU3RyaW5nKDM2KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gcmVzb2x2ZVRoZW5hYmxlKHRoZW5hYmxlKSB7XG4gICAgICBzd2l0Y2ggKHRoZW5hYmxlLnN0YXR1cykge1xuICAgICAgICBjYXNlIFwiZnVsZmlsbGVkXCI6XG4gICAgICAgICAgcmV0dXJuIHRoZW5hYmxlLnZhbHVlO1xuICAgICAgICBjYXNlIFwicmVqZWN0ZWRcIjpcbiAgICAgICAgICB0aHJvdyB0aGVuYWJsZS5yZWFzb247XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgc3dpdGNoIChcbiAgICAgICAgICAgIChcInN0cmluZ1wiID09PSB0eXBlb2YgdGhlbmFibGUuc3RhdHVzXG4gICAgICAgICAgICAgID8gdGhlbmFibGUudGhlbihub29wLCBub29wKVxuICAgICAgICAgICAgICA6ICgodGhlbmFibGUuc3RhdHVzID0gXCJwZW5kaW5nXCIpLFxuICAgICAgICAgICAgICAgIHRoZW5hYmxlLnRoZW4oXG4gICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoZnVsZmlsbGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgXCJwZW5kaW5nXCIgPT09IHRoZW5hYmxlLnN0YXR1cyAmJlxuICAgICAgICAgICAgICAgICAgICAgICgodGhlbmFibGUuc3RhdHVzID0gXCJmdWxmaWxsZWRcIiksXG4gICAgICAgICAgICAgICAgICAgICAgKHRoZW5hYmxlLnZhbHVlID0gZnVsZmlsbGVkVmFsdWUpKTtcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgXCJwZW5kaW5nXCIgPT09IHRoZW5hYmxlLnN0YXR1cyAmJlxuICAgICAgICAgICAgICAgICAgICAgICgodGhlbmFibGUuc3RhdHVzID0gXCJyZWplY3RlZFwiKSxcbiAgICAgICAgICAgICAgICAgICAgICAodGhlbmFibGUucmVhc29uID0gZXJyb3IpKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApKSxcbiAgICAgICAgICAgIHRoZW5hYmxlLnN0YXR1cylcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNhc2UgXCJmdWxmaWxsZWRcIjpcbiAgICAgICAgICAgICAgcmV0dXJuIHRoZW5hYmxlLnZhbHVlO1xuICAgICAgICAgICAgY2FzZSBcInJlamVjdGVkXCI6XG4gICAgICAgICAgICAgIHRocm93IHRoZW5hYmxlLnJlYXNvbjtcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aHJvdyB0aGVuYWJsZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbWFwSW50b0FycmF5KGNoaWxkcmVuLCBhcnJheSwgZXNjYXBlZFByZWZpeCwgbmFtZVNvRmFyLCBjYWxsYmFjaykge1xuICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgY2hpbGRyZW47XG4gICAgICBpZiAoXCJ1bmRlZmluZWRcIiA9PT0gdHlwZSB8fCBcImJvb2xlYW5cIiA9PT0gdHlwZSkgY2hpbGRyZW4gPSBudWxsO1xuICAgICAgdmFyIGludm9rZUNhbGxiYWNrID0gITE7XG4gICAgICBpZiAobnVsbCA9PT0gY2hpbGRyZW4pIGludm9rZUNhbGxiYWNrID0gITA7XG4gICAgICBlbHNlXG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgIGNhc2UgXCJiaWdpbnRcIjpcbiAgICAgICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2sgPSAhMDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgXCJvYmplY3RcIjpcbiAgICAgICAgICAgIHN3aXRjaCAoY2hpbGRyZW4uJCR0eXBlb2YpIHtcbiAgICAgICAgICAgICAgY2FzZSBSRUFDVF9FTEVNRU5UX1RZUEU6XG4gICAgICAgICAgICAgIGNhc2UgUkVBQ1RfUE9SVEFMX1RZUEU6XG4gICAgICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2sgPSAhMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSBSRUFDVF9MQVpZX1RZUEU6XG4gICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgIChpbnZva2VDYWxsYmFjayA9IGNoaWxkcmVuLl9pbml0KSxcbiAgICAgICAgICAgICAgICAgIG1hcEludG9BcnJheShcbiAgICAgICAgICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2soY2hpbGRyZW4uX3BheWxvYWQpLFxuICAgICAgICAgICAgICAgICAgICBhcnJheSxcbiAgICAgICAgICAgICAgICAgICAgZXNjYXBlZFByZWZpeCxcbiAgICAgICAgICAgICAgICAgICAgbmFtZVNvRmFyLFxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja1xuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIGlmIChpbnZva2VDYWxsYmFjaykge1xuICAgICAgICBpbnZva2VDYWxsYmFjayA9IGNoaWxkcmVuO1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrKGludm9rZUNhbGxiYWNrKTtcbiAgICAgICAgdmFyIGNoaWxkS2V5ID1cbiAgICAgICAgICBcIlwiID09PSBuYW1lU29GYXIgPyBcIi5cIiArIGdldEVsZW1lbnRLZXkoaW52b2tlQ2FsbGJhY2ssIDApIDogbmFtZVNvRmFyO1xuICAgICAgICBpc0FycmF5SW1wbChjYWxsYmFjaylcbiAgICAgICAgICA/ICgoZXNjYXBlZFByZWZpeCA9IFwiXCIpLFxuICAgICAgICAgICAgbnVsbCAhPSBjaGlsZEtleSAmJlxuICAgICAgICAgICAgICAoZXNjYXBlZFByZWZpeCA9XG4gICAgICAgICAgICAgICAgY2hpbGRLZXkucmVwbGFjZSh1c2VyUHJvdmlkZWRLZXlFc2NhcGVSZWdleCwgXCIkJi9cIikgKyBcIi9cIiksXG4gICAgICAgICAgICBtYXBJbnRvQXJyYXkoY2FsbGJhY2ssIGFycmF5LCBlc2NhcGVkUHJlZml4LCBcIlwiLCBmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgICByZXR1cm4gYztcbiAgICAgICAgICAgIH0pKVxuICAgICAgICAgIDogbnVsbCAhPSBjYWxsYmFjayAmJlxuICAgICAgICAgICAgKGlzVmFsaWRFbGVtZW50KGNhbGxiYWNrKSAmJlxuICAgICAgICAgICAgICAobnVsbCAhPSBjYWxsYmFjay5rZXkgJiZcbiAgICAgICAgICAgICAgICAoKGludm9rZUNhbGxiYWNrICYmIGludm9rZUNhbGxiYWNrLmtleSA9PT0gY2FsbGJhY2sua2V5KSB8fFxuICAgICAgICAgICAgICAgICAgY2hlY2tLZXlTdHJpbmdDb2VyY2lvbihjYWxsYmFjay5rZXkpKSxcbiAgICAgICAgICAgICAgKGVzY2FwZWRQcmVmaXggPSBjbG9uZUFuZFJlcGxhY2VLZXkoXG4gICAgICAgICAgICAgICAgY2FsbGJhY2ssXG4gICAgICAgICAgICAgICAgZXNjYXBlZFByZWZpeCArXG4gICAgICAgICAgICAgICAgICAobnVsbCA9PSBjYWxsYmFjay5rZXkgfHxcbiAgICAgICAgICAgICAgICAgIChpbnZva2VDYWxsYmFjayAmJiBpbnZva2VDYWxsYmFjay5rZXkgPT09IGNhbGxiYWNrLmtleSlcbiAgICAgICAgICAgICAgICAgICAgPyBcIlwiXG4gICAgICAgICAgICAgICAgICAgIDogKFwiXCIgKyBjYWxsYmFjay5rZXkpLnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VyUHJvdmlkZWRLZXlFc2NhcGVSZWdleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiJCYvXCJcbiAgICAgICAgICAgICAgICAgICAgICApICsgXCIvXCIpICtcbiAgICAgICAgICAgICAgICAgIGNoaWxkS2V5XG4gICAgICAgICAgICAgICkpLFxuICAgICAgICAgICAgICBcIlwiICE9PSBuYW1lU29GYXIgJiZcbiAgICAgICAgICAgICAgICBudWxsICE9IGludm9rZUNhbGxiYWNrICYmXG4gICAgICAgICAgICAgICAgaXNWYWxpZEVsZW1lbnQoaW52b2tlQ2FsbGJhY2spICYmXG4gICAgICAgICAgICAgICAgbnVsbCA9PSBpbnZva2VDYWxsYmFjay5rZXkgJiZcbiAgICAgICAgICAgICAgICBpbnZva2VDYWxsYmFjay5fc3RvcmUgJiZcbiAgICAgICAgICAgICAgICAhaW52b2tlQ2FsbGJhY2suX3N0b3JlLnZhbGlkYXRlZCAmJlxuICAgICAgICAgICAgICAgIChlc2NhcGVkUHJlZml4Ll9zdG9yZS52YWxpZGF0ZWQgPSAyKSxcbiAgICAgICAgICAgICAgKGNhbGxiYWNrID0gZXNjYXBlZFByZWZpeCkpLFxuICAgICAgICAgICAgYXJyYXkucHVzaChjYWxsYmFjaykpO1xuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cbiAgICAgIGludm9rZUNhbGxiYWNrID0gMDtcbiAgICAgIGNoaWxkS2V5ID0gXCJcIiA9PT0gbmFtZVNvRmFyID8gXCIuXCIgOiBuYW1lU29GYXIgKyBcIjpcIjtcbiAgICAgIGlmIChpc0FycmF5SW1wbChjaGlsZHJlbikpXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspXG4gICAgICAgICAgKG5hbWVTb0ZhciA9IGNoaWxkcmVuW2ldKSxcbiAgICAgICAgICAgICh0eXBlID0gY2hpbGRLZXkgKyBnZXRFbGVtZW50S2V5KG5hbWVTb0ZhciwgaSkpLFxuICAgICAgICAgICAgKGludm9rZUNhbGxiYWNrICs9IG1hcEludG9BcnJheShcbiAgICAgICAgICAgICAgbmFtZVNvRmFyLFxuICAgICAgICAgICAgICBhcnJheSxcbiAgICAgICAgICAgICAgZXNjYXBlZFByZWZpeCxcbiAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgY2FsbGJhY2tcbiAgICAgICAgICAgICkpO1xuICAgICAgZWxzZSBpZiAoKChpID0gZ2V0SXRlcmF0b3JGbihjaGlsZHJlbikpLCBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBpKSlcbiAgICAgICAgZm9yIChcbiAgICAgICAgICBpID09PSBjaGlsZHJlbi5lbnRyaWVzICYmXG4gICAgICAgICAgICAoZGlkV2FybkFib3V0TWFwcyB8fFxuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgXCJVc2luZyBNYXBzIGFzIGNoaWxkcmVuIGlzIG5vdCBzdXBwb3J0ZWQuIFVzZSBhbiBhcnJheSBvZiBrZXllZCBSZWFjdEVsZW1lbnRzIGluc3RlYWQuXCJcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIChkaWRXYXJuQWJvdXRNYXBzID0gITApKSxcbiAgICAgICAgICAgIGNoaWxkcmVuID0gaS5jYWxsKGNoaWxkcmVuKSxcbiAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICAgICEobmFtZVNvRmFyID0gY2hpbGRyZW4ubmV4dCgpKS5kb25lO1xuXG4gICAgICAgIClcbiAgICAgICAgICAobmFtZVNvRmFyID0gbmFtZVNvRmFyLnZhbHVlKSxcbiAgICAgICAgICAgICh0eXBlID0gY2hpbGRLZXkgKyBnZXRFbGVtZW50S2V5KG5hbWVTb0ZhciwgaSsrKSksXG4gICAgICAgICAgICAoaW52b2tlQ2FsbGJhY2sgKz0gbWFwSW50b0FycmF5KFxuICAgICAgICAgICAgICBuYW1lU29GYXIsXG4gICAgICAgICAgICAgIGFycmF5LFxuICAgICAgICAgICAgICBlc2NhcGVkUHJlZml4LFxuICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICBjYWxsYmFja1xuICAgICAgICAgICAgKSk7XG4gICAgICBlbHNlIGlmIChcIm9iamVjdFwiID09PSB0eXBlKSB7XG4gICAgICAgIGlmIChcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBjaGlsZHJlbi50aGVuKVxuICAgICAgICAgIHJldHVybiBtYXBJbnRvQXJyYXkoXG4gICAgICAgICAgICByZXNvbHZlVGhlbmFibGUoY2hpbGRyZW4pLFxuICAgICAgICAgICAgYXJyYXksXG4gICAgICAgICAgICBlc2NhcGVkUHJlZml4LFxuICAgICAgICAgICAgbmFtZVNvRmFyLFxuICAgICAgICAgICAgY2FsbGJhY2tcbiAgICAgICAgICApO1xuICAgICAgICBhcnJheSA9IFN0cmluZyhjaGlsZHJlbik7XG4gICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgIFwiT2JqZWN0cyBhcmUgbm90IHZhbGlkIGFzIGEgUmVhY3QgY2hpbGQgKGZvdW5kOiBcIiArXG4gICAgICAgICAgICAoXCJbb2JqZWN0IE9iamVjdF1cIiA9PT0gYXJyYXlcbiAgICAgICAgICAgICAgPyBcIm9iamVjdCB3aXRoIGtleXMge1wiICsgT2JqZWN0LmtleXMoY2hpbGRyZW4pLmpvaW4oXCIsIFwiKSArIFwifVwiXG4gICAgICAgICAgICAgIDogYXJyYXkpICtcbiAgICAgICAgICAgIFwiKS4gSWYgeW91IG1lYW50IHRvIHJlbmRlciBhIGNvbGxlY3Rpb24gb2YgY2hpbGRyZW4sIHVzZSBhbiBhcnJheSBpbnN0ZWFkLlwiXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW52b2tlQ2FsbGJhY2s7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG1hcENoaWxkcmVuKGNoaWxkcmVuLCBmdW5jLCBjb250ZXh0KSB7XG4gICAgICBpZiAobnVsbCA9PSBjaGlsZHJlbikgcmV0dXJuIGNoaWxkcmVuO1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLFxuICAgICAgICBjb3VudCA9IDA7XG4gICAgICBtYXBJbnRvQXJyYXkoY2hpbGRyZW4sIHJlc3VsdCwgXCJcIiwgXCJcIiwgZnVuY3Rpb24gKGNoaWxkKSB7XG4gICAgICAgIHJldHVybiBmdW5jLmNhbGwoY29udGV4dCwgY2hpbGQsIGNvdW50KyspO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBmdW5jdGlvbiBsYXp5SW5pdGlhbGl6ZXIocGF5bG9hZCkge1xuICAgICAgaWYgKC0xID09PSBwYXlsb2FkLl9zdGF0dXMpIHtcbiAgICAgICAgdmFyIGlvSW5mbyA9IHBheWxvYWQuX2lvSW5mbztcbiAgICAgICAgbnVsbCAhPSBpb0luZm8gJiYgKGlvSW5mby5zdGFydCA9IGlvSW5mby5lbmQgPSBwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgIGlvSW5mbyA9IHBheWxvYWQuX3Jlc3VsdDtcbiAgICAgICAgdmFyIHRoZW5hYmxlID0gaW9JbmZvKCk7XG4gICAgICAgIHRoZW5hYmxlLnRoZW4oXG4gICAgICAgICAgZnVuY3Rpb24gKG1vZHVsZU9iamVjdCkge1xuICAgICAgICAgICAgaWYgKDAgPT09IHBheWxvYWQuX3N0YXR1cyB8fCAtMSA9PT0gcGF5bG9hZC5fc3RhdHVzKSB7XG4gICAgICAgICAgICAgIHBheWxvYWQuX3N0YXR1cyA9IDE7XG4gICAgICAgICAgICAgIHBheWxvYWQuX3Jlc3VsdCA9IG1vZHVsZU9iamVjdDtcbiAgICAgICAgICAgICAgdmFyIF9pb0luZm8gPSBwYXlsb2FkLl9pb0luZm87XG4gICAgICAgICAgICAgIG51bGwgIT0gX2lvSW5mbyAmJiAoX2lvSW5mby5lbmQgPSBwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgICAgICAgIHZvaWQgMCA9PT0gdGhlbmFibGUuc3RhdHVzICYmXG4gICAgICAgICAgICAgICAgKCh0aGVuYWJsZS5zdGF0dXMgPSBcImZ1bGZpbGxlZFwiKSxcbiAgICAgICAgICAgICAgICAodGhlbmFibGUudmFsdWUgPSBtb2R1bGVPYmplY3QpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgaWYgKDAgPT09IHBheWxvYWQuX3N0YXR1cyB8fCAtMSA9PT0gcGF5bG9hZC5fc3RhdHVzKSB7XG4gICAgICAgICAgICAgIHBheWxvYWQuX3N0YXR1cyA9IDI7XG4gICAgICAgICAgICAgIHBheWxvYWQuX3Jlc3VsdCA9IGVycm9yO1xuICAgICAgICAgICAgICB2YXIgX2lvSW5mbzIgPSBwYXlsb2FkLl9pb0luZm87XG4gICAgICAgICAgICAgIG51bGwgIT0gX2lvSW5mbzIgJiYgKF9pb0luZm8yLmVuZCA9IHBlcmZvcm1hbmNlLm5vdygpKTtcbiAgICAgICAgICAgICAgdm9pZCAwID09PSB0aGVuYWJsZS5zdGF0dXMgJiZcbiAgICAgICAgICAgICAgICAoKHRoZW5hYmxlLnN0YXR1cyA9IFwicmVqZWN0ZWRcIiksICh0aGVuYWJsZS5yZWFzb24gPSBlcnJvcikpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgaW9JbmZvID0gcGF5bG9hZC5faW9JbmZvO1xuICAgICAgICBpZiAobnVsbCAhPSBpb0luZm8pIHtcbiAgICAgICAgICBpb0luZm8udmFsdWUgPSB0aGVuYWJsZTtcbiAgICAgICAgICB2YXIgZGlzcGxheU5hbWUgPSB0aGVuYWJsZS5kaXNwbGF5TmFtZTtcbiAgICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2YgZGlzcGxheU5hbWUgJiYgKGlvSW5mby5uYW1lID0gZGlzcGxheU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIC0xID09PSBwYXlsb2FkLl9zdGF0dXMgJiZcbiAgICAgICAgICAoKHBheWxvYWQuX3N0YXR1cyA9IDApLCAocGF5bG9hZC5fcmVzdWx0ID0gdGhlbmFibGUpKTtcbiAgICAgIH1cbiAgICAgIGlmICgxID09PSBwYXlsb2FkLl9zdGF0dXMpXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgKGlvSW5mbyA9IHBheWxvYWQuX3Jlc3VsdCksXG4gICAgICAgICAgdm9pZCAwID09PSBpb0luZm8gJiZcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwibGF6eTogRXhwZWN0ZWQgdGhlIHJlc3VsdCBvZiBhIGR5bmFtaWMgaW1wb3J0KCkgY2FsbC4gSW5zdGVhZCByZWNlaXZlZDogJXNcXG5cXG5Zb3VyIGNvZGUgc2hvdWxkIGxvb2sgbGlrZTogXFxuICBjb25zdCBNeUNvbXBvbmVudCA9IGxhenkoKCkgPT4gaW1wb3J0KCcuL015Q29tcG9uZW50JykpXFxuXFxuRGlkIHlvdSBhY2NpZGVudGFsbHkgcHV0IGN1cmx5IGJyYWNlcyBhcm91bmQgdGhlIGltcG9ydD9cIixcbiAgICAgICAgICAgICAgaW9JbmZvXG4gICAgICAgICAgICApLFxuICAgICAgICAgIFwiZGVmYXVsdFwiIGluIGlvSW5mbyB8fFxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgXCJsYXp5OiBFeHBlY3RlZCB0aGUgcmVzdWx0IG9mIGEgZHluYW1pYyBpbXBvcnQoKSBjYWxsLiBJbnN0ZWFkIHJlY2VpdmVkOiAlc1xcblxcbllvdXIgY29kZSBzaG91bGQgbG9vayBsaWtlOiBcXG4gIGNvbnN0IE15Q29tcG9uZW50ID0gbGF6eSgoKSA9PiBpbXBvcnQoJy4vTXlDb21wb25lbnQnKSlcIixcbiAgICAgICAgICAgICAgaW9JbmZvXG4gICAgICAgICAgICApLFxuICAgICAgICAgIGlvSW5mby5kZWZhdWx0XG4gICAgICAgICk7XG4gICAgICB0aHJvdyBwYXlsb2FkLl9yZXN1bHQ7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlc29sdmVEaXNwYXRjaGVyKCkge1xuICAgICAgdmFyIGRpc3BhdGNoZXIgPSBSZWFjdFNoYXJlZEludGVybmFscy5IO1xuICAgICAgbnVsbCA9PT0gZGlzcGF0Y2hlciAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiSW52YWxpZCBob29rIGNhbGwuIEhvb2tzIGNhbiBvbmx5IGJlIGNhbGxlZCBpbnNpZGUgb2YgdGhlIGJvZHkgb2YgYSBmdW5jdGlvbiBjb21wb25lbnQuIFRoaXMgY291bGQgaGFwcGVuIGZvciBvbmUgb2YgdGhlIGZvbGxvd2luZyByZWFzb25zOlxcbjEuIFlvdSBtaWdodCBoYXZlIG1pc21hdGNoaW5nIHZlcnNpb25zIG9mIFJlYWN0IGFuZCB0aGUgcmVuZGVyZXIgKHN1Y2ggYXMgUmVhY3QgRE9NKVxcbjIuIFlvdSBtaWdodCBiZSBicmVha2luZyB0aGUgUnVsZXMgb2YgSG9va3NcXG4zLiBZb3UgbWlnaHQgaGF2ZSBtb3JlIHRoYW4gb25lIGNvcHkgb2YgUmVhY3QgaW4gdGhlIHNhbWUgYXBwXFxuU2VlIGh0dHBzOi8vcmVhY3QuZGV2L2xpbmsvaW52YWxpZC1ob29rLWNhbGwgZm9yIHRpcHMgYWJvdXQgaG93IHRvIGRlYnVnIGFuZCBmaXggdGhpcyBwcm9ibGVtLlwiXG4gICAgICAgICk7XG4gICAgICByZXR1cm4gZGlzcGF0Y2hlcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gcmVsZWFzZUFzeW5jVHJhbnNpdGlvbigpIHtcbiAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzLmFzeW5jVHJhbnNpdGlvbnMtLTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZW5xdWV1ZVRhc2sodGFzaykge1xuICAgICAgaWYgKG51bGwgPT09IGVucXVldWVUYXNrSW1wbClcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgcmVxdWlyZVN0cmluZyA9IChcInJlcXVpcmVcIiArIE1hdGgucmFuZG9tKCkpLnNsaWNlKDAsIDcpO1xuICAgICAgICAgIGVucXVldWVUYXNrSW1wbCA9IChtb2R1bGUgJiYgbW9kdWxlW3JlcXVpcmVTdHJpbmddKS5jYWxsKFxuICAgICAgICAgICAgbW9kdWxlLFxuICAgICAgICAgICAgXCJ0aW1lcnNcIlxuICAgICAgICAgICkuc2V0SW1tZWRpYXRlO1xuICAgICAgICB9IGNhdGNoIChfZXJyKSB7XG4gICAgICAgICAgZW5xdWV1ZVRhc2tJbXBsID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAhMSA9PT0gZGlkV2FybkFib3V0TWVzc2FnZUNoYW5uZWwgJiZcbiAgICAgICAgICAgICAgKChkaWRXYXJuQWJvdXRNZXNzYWdlQ2hhbm5lbCA9ICEwKSxcbiAgICAgICAgICAgICAgXCJ1bmRlZmluZWRcIiA9PT0gdHlwZW9mIE1lc3NhZ2VDaGFubmVsICYmXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgICAgIFwiVGhpcyBicm93c2VyIGRvZXMgbm90IGhhdmUgYSBNZXNzYWdlQ2hhbm5lbCBpbXBsZW1lbnRhdGlvbiwgc28gZW5xdWV1aW5nIHRhc2tzIHZpYSBhd2FpdCBhY3QoYXN5bmMgKCkgPT4gLi4uKSB3aWxsIGZhaWwuIFBsZWFzZSBmaWxlIGFuIGlzc3VlIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9pc3N1ZXMgaWYgeW91IGVuY291bnRlciB0aGlzIHdhcm5pbmcuXCJcbiAgICAgICAgICAgICAgICApKTtcbiAgICAgICAgICAgIHZhciBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gICAgICAgICAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSh2b2lkIDApO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIHJldHVybiBlbnF1ZXVlVGFza0ltcGwodGFzayk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGFnZ3JlZ2F0ZUVycm9ycyhlcnJvcnMpIHtcbiAgICAgIHJldHVybiAxIDwgZXJyb3JzLmxlbmd0aCAmJiBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBBZ2dyZWdhdGVFcnJvclxuICAgICAgICA/IG5ldyBBZ2dyZWdhdGVFcnJvcihlcnJvcnMpXG4gICAgICAgIDogZXJyb3JzWzBdO1xuICAgIH1cbiAgICBmdW5jdGlvbiBwb3BBY3RTY29wZShwcmV2QWN0UXVldWUsIHByZXZBY3RTY29wZURlcHRoKSB7XG4gICAgICBwcmV2QWN0U2NvcGVEZXB0aCAhPT0gYWN0U2NvcGVEZXB0aCAtIDEgJiZcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIllvdSBzZWVtIHRvIGhhdmUgb3ZlcmxhcHBpbmcgYWN0KCkgY2FsbHMsIHRoaXMgaXMgbm90IHN1cHBvcnRlZC4gQmUgc3VyZSB0byBhd2FpdCBwcmV2aW91cyBhY3QoKSBjYWxscyBiZWZvcmUgbWFraW5nIGEgbmV3IG9uZS4gXCJcbiAgICAgICAgKTtcbiAgICAgIGFjdFNjb3BlRGVwdGggPSBwcmV2QWN0U2NvcGVEZXB0aDtcbiAgICB9XG4gICAgZnVuY3Rpb24gcmVjdXJzaXZlbHlGbHVzaEFzeW5jQWN0V29yayhyZXR1cm5WYWx1ZSwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgcXVldWUgPSBSZWFjdFNoYXJlZEludGVybmFscy5hY3RRdWV1ZTtcbiAgICAgIGlmIChudWxsICE9PSBxdWV1ZSlcbiAgICAgICAgaWYgKDAgIT09IHF1ZXVlLmxlbmd0aClcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZmx1c2hBY3RRdWV1ZShxdWV1ZSk7XG4gICAgICAgICAgICBlbnF1ZXVlVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJldHVybiByZWN1cnNpdmVseUZsdXNoQXN5bmNBY3RXb3JrKHJldHVyblZhbHVlLCByZXNvbHZlLCByZWplY3QpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5wdXNoKGVycm9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIGVsc2UgUmVhY3RTaGFyZWRJbnRlcm5hbHMuYWN0UXVldWUgPSBudWxsO1xuICAgICAgMCA8IFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGhcbiAgICAgICAgPyAoKHF1ZXVlID0gYWdncmVnYXRlRXJyb3JzKFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycykpLFxuICAgICAgICAgIChSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoID0gMCksXG4gICAgICAgICAgcmVqZWN0KHF1ZXVlKSlcbiAgICAgICAgOiByZXNvbHZlKHJldHVyblZhbHVlKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZmx1c2hBY3RRdWV1ZShxdWV1ZSkge1xuICAgICAgaWYgKCFpc0ZsdXNoaW5nKSB7XG4gICAgICAgIGlzRmx1c2hpbmcgPSAhMDtcbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGZvciAoOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IHF1ZXVlW2ldO1xuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy5kaWRVc2VQcm9taXNlID0gITE7XG4gICAgICAgICAgICAgIHZhciBjb250aW51YXRpb24gPSBjYWxsYmFjayghMSk7XG4gICAgICAgICAgICAgIGlmIChudWxsICE9PSBjb250aW51YXRpb24pIHtcbiAgICAgICAgICAgICAgICBpZiAoUmVhY3RTaGFyZWRJbnRlcm5hbHMuZGlkVXNlUHJvbWlzZSkge1xuICAgICAgICAgICAgICAgICAgcXVldWVbaV0gPSBjYWxsYmFjaztcbiAgICAgICAgICAgICAgICAgIHF1ZXVlLnNwbGljZSgwLCBpKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBjb250aW51YXRpb247XG4gICAgICAgICAgICAgIH0gZWxzZSBicmVhaztcbiAgICAgICAgICAgIH0gd2hpbGUgKDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBxdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIHF1ZXVlLnNwbGljZSgwLCBpICsgMSksIFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5wdXNoKGVycm9yKTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICBpc0ZsdXNoaW5nID0gITE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXCJ1bmRlZmluZWRcIiAhPT0gdHlwZW9mIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXyAmJlxuICAgICAgXCJmdW5jdGlvblwiID09PVxuICAgICAgICB0eXBlb2YgX19SRUFDVF9ERVZUT09MU19HTE9CQUxfSE9PS19fLnJlZ2lzdGVySW50ZXJuYWxNb2R1bGVTdGFydCAmJlxuICAgICAgX19SRUFDVF9ERVZUT09MU19HTE9CQUxfSE9PS19fLnJlZ2lzdGVySW50ZXJuYWxNb2R1bGVTdGFydChFcnJvcigpKTtcbiAgICB2YXIgUkVBQ1RfRUxFTUVOVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnRyYW5zaXRpb25hbC5lbGVtZW50XCIpLFxuICAgICAgUkVBQ1RfUE9SVEFMX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QucG9ydGFsXCIpLFxuICAgICAgUkVBQ1RfRlJBR01FTlRfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5mcmFnbWVudFwiKSxcbiAgICAgIFJFQUNUX1NUUklDVF9NT0RFX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3Quc3RyaWN0X21vZGVcIiksXG4gICAgICBSRUFDVF9QUk9GSUxFUl9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnByb2ZpbGVyXCIpLFxuICAgICAgUkVBQ1RfQ09OU1VNRVJfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5jb25zdW1lclwiKSxcbiAgICAgIFJFQUNUX0NPTlRFWFRfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5jb250ZXh0XCIpLFxuICAgICAgUkVBQ1RfRk9SV0FSRF9SRUZfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5mb3J3YXJkX3JlZlwiKSxcbiAgICAgIFJFQUNUX1NVU1BFTlNFX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3Quc3VzcGVuc2VcIiksXG4gICAgICBSRUFDVF9TVVNQRU5TRV9MSVNUX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3Quc3VzcGVuc2VfbGlzdFwiKSxcbiAgICAgIFJFQUNUX01FTU9fVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5tZW1vXCIpLFxuICAgICAgUkVBQ1RfTEFaWV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmxhenlcIiksXG4gICAgICBSRUFDVF9BQ1RJVklUWV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmFjdGl2aXR5XCIpLFxuICAgICAgTUFZQkVfSVRFUkFUT1JfU1lNQk9MID0gU3ltYm9sLml0ZXJhdG9yLFxuICAgICAgZGlkV2FyblN0YXRlVXBkYXRlRm9yVW5tb3VudGVkQ29tcG9uZW50ID0ge30sXG4gICAgICBSZWFjdE5vb3BVcGRhdGVRdWV1ZSA9IHtcbiAgICAgICAgaXNNb3VudGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuICExO1xuICAgICAgICB9LFxuICAgICAgICBlbnF1ZXVlRm9yY2VVcGRhdGU6IGZ1bmN0aW9uIChwdWJsaWNJbnN0YW5jZSkge1xuICAgICAgICAgIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCBcImZvcmNlVXBkYXRlXCIpO1xuICAgICAgICB9LFxuICAgICAgICBlbnF1ZXVlUmVwbGFjZVN0YXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UpIHtcbiAgICAgICAgICB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgXCJyZXBsYWNlU3RhdGVcIik7XG4gICAgICAgIH0sXG4gICAgICAgIGVucXVldWVTZXRTdGF0ZTogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlKSB7XG4gICAgICAgICAgd2Fybk5vb3AocHVibGljSW5zdGFuY2UsIFwic2V0U3RhdGVcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBhc3NpZ24gPSBPYmplY3QuYXNzaWduLFxuICAgICAgZW1wdHlPYmplY3QgPSB7fTtcbiAgICBPYmplY3QuZnJlZXplKGVtcHR5T2JqZWN0KTtcbiAgICBDb21wb25lbnQucHJvdG90eXBlLmlzUmVhY3RDb21wb25lbnQgPSB7fTtcbiAgICBDb21wb25lbnQucHJvdG90eXBlLnNldFN0YXRlID0gZnVuY3Rpb24gKHBhcnRpYWxTdGF0ZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmIChcbiAgICAgICAgXCJvYmplY3RcIiAhPT0gdHlwZW9mIHBhcnRpYWxTdGF0ZSAmJlxuICAgICAgICBcImZ1bmN0aW9uXCIgIT09IHR5cGVvZiBwYXJ0aWFsU3RhdGUgJiZcbiAgICAgICAgbnVsbCAhPSBwYXJ0aWFsU3RhdGVcbiAgICAgIClcbiAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgXCJ0YWtlcyBhbiBvYmplY3Qgb2Ygc3RhdGUgdmFyaWFibGVzIHRvIHVwZGF0ZSBvciBhIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYW4gb2JqZWN0IG9mIHN0YXRlIHZhcmlhYmxlcy5cIlxuICAgICAgICApO1xuICAgICAgdGhpcy51cGRhdGVyLmVucXVldWVTZXRTdGF0ZSh0aGlzLCBwYXJ0aWFsU3RhdGUsIGNhbGxiYWNrLCBcInNldFN0YXRlXCIpO1xuICAgIH07XG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5mb3JjZVVwZGF0ZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgdGhpcy51cGRhdGVyLmVucXVldWVGb3JjZVVwZGF0ZSh0aGlzLCBjYWxsYmFjaywgXCJmb3JjZVVwZGF0ZVwiKTtcbiAgICB9O1xuICAgIHZhciBkZXByZWNhdGVkQVBJcyA9IHtcbiAgICAgIGlzTW91bnRlZDogW1xuICAgICAgICBcImlzTW91bnRlZFwiLFxuICAgICAgICBcIkluc3RlYWQsIG1ha2Ugc3VyZSB0byBjbGVhbiB1cCBzdWJzY3JpcHRpb25zIGFuZCBwZW5kaW5nIHJlcXVlc3RzIGluIGNvbXBvbmVudFdpbGxVbm1vdW50IHRvIHByZXZlbnQgbWVtb3J5IGxlYWtzLlwiXG4gICAgICBdLFxuICAgICAgcmVwbGFjZVN0YXRlOiBbXG4gICAgICAgIFwicmVwbGFjZVN0YXRlXCIsXG4gICAgICAgIFwiUmVmYWN0b3IgeW91ciBjb2RlIHRvIHVzZSBzZXRTdGF0ZSBpbnN0ZWFkIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL3JlYWN0L2lzc3Vlcy8zMjM2KS5cIlxuICAgICAgXVxuICAgIH07XG4gICAgZm9yIChmbk5hbWUgaW4gZGVwcmVjYXRlZEFQSXMpXG4gICAgICBkZXByZWNhdGVkQVBJcy5oYXNPd25Qcm9wZXJ0eShmbk5hbWUpICYmXG4gICAgICAgIGRlZmluZURlcHJlY2F0aW9uV2FybmluZyhmbk5hbWUsIGRlcHJlY2F0ZWRBUElzW2ZuTmFtZV0pO1xuICAgIENvbXBvbmVudER1bW15LnByb3RvdHlwZSA9IENvbXBvbmVudC5wcm90b3R5cGU7XG4gICAgZGVwcmVjYXRlZEFQSXMgPSBQdXJlQ29tcG9uZW50LnByb3RvdHlwZSA9IG5ldyBDb21wb25lbnREdW1teSgpO1xuICAgIGRlcHJlY2F0ZWRBUElzLmNvbnN0cnVjdG9yID0gUHVyZUNvbXBvbmVudDtcbiAgICBhc3NpZ24oZGVwcmVjYXRlZEFQSXMsIENvbXBvbmVudC5wcm90b3R5cGUpO1xuICAgIGRlcHJlY2F0ZWRBUElzLmlzUHVyZVJlYWN0Q29tcG9uZW50ID0gITA7XG4gICAgdmFyIGlzQXJyYXlJbXBsID0gQXJyYXkuaXNBcnJheSxcbiAgICAgIFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0UgPSBTeW1ib2wuZm9yKFwicmVhY3QuY2xpZW50LnJlZmVyZW5jZVwiKSxcbiAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzID0ge1xuICAgICAgICBIOiBudWxsLFxuICAgICAgICBBOiBudWxsLFxuICAgICAgICBUOiBudWxsLFxuICAgICAgICBTOiBudWxsLFxuICAgICAgICBhY3RRdWV1ZTogbnVsbCxcbiAgICAgICAgYXN5bmNUcmFuc2l0aW9uczogMCxcbiAgICAgICAgaXNCYXRjaGluZ0xlZ2FjeTogITEsXG4gICAgICAgIGRpZFNjaGVkdWxlTGVnYWN5VXBkYXRlOiAhMSxcbiAgICAgICAgZGlkVXNlUHJvbWlzZTogITEsXG4gICAgICAgIHRocm93bkVycm9yczogW10sXG4gICAgICAgIGdldEN1cnJlbnRTdGFjazogbnVsbCxcbiAgICAgICAgcmVjZW50bHlDcmVhdGVkT3duZXJTdGFja3M6IDBcbiAgICAgIH0sXG4gICAgICBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHksXG4gICAgICBjcmVhdGVUYXNrID0gY29uc29sZS5jcmVhdGVUYXNrXG4gICAgICAgID8gY29uc29sZS5jcmVhdGVUYXNrXG4gICAgICAgIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfTtcbiAgICBkZXByZWNhdGVkQVBJcyA9IHtcbiAgICAgIHJlYWN0X3N0YWNrX2JvdHRvbV9mcmFtZTogZnVuY3Rpb24gKGNhbGxTdGFja0ZvckVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYWxsU3RhY2tGb3JFcnJvcigpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHNwZWNpYWxQcm9wS2V5V2FybmluZ1Nob3duLCBkaWRXYXJuQWJvdXRPbGRKU1hSdW50aW1lO1xuICAgIHZhciBkaWRXYXJuQWJvdXRFbGVtZW50UmVmID0ge307XG4gICAgdmFyIHVua25vd25Pd25lckRlYnVnU3RhY2sgPSBkZXByZWNhdGVkQVBJcy5yZWFjdF9zdGFja19ib3R0b21fZnJhbWUuYmluZChcbiAgICAgIGRlcHJlY2F0ZWRBUElzLFxuICAgICAgVW5rbm93bk93bmVyXG4gICAgKSgpO1xuICAgIHZhciB1bmtub3duT3duZXJEZWJ1Z1Rhc2sgPSBjcmVhdGVUYXNrKGdldFRhc2tOYW1lKFVua25vd25Pd25lcikpO1xuICAgIHZhciBkaWRXYXJuQWJvdXRNYXBzID0gITEsXG4gICAgICB1c2VyUHJvdmlkZWRLZXlFc2NhcGVSZWdleCA9IC9cXC8rL2csXG4gICAgICByZXBvcnRHbG9iYWxFcnJvciA9XG4gICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHJlcG9ydEVycm9yXG4gICAgICAgICAgPyByZXBvcnRFcnJvclxuICAgICAgICAgIDogZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2Ygd2luZG93ICYmXG4gICAgICAgICAgICAgICAgXCJmdW5jdGlvblwiID09PSB0eXBlb2Ygd2luZG93LkVycm9yRXZlbnRcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgdmFyIGV2ZW50ID0gbmV3IHdpbmRvdy5FcnJvckV2ZW50KFwiZXJyb3JcIiwge1xuICAgICAgICAgICAgICAgICAgYnViYmxlczogITAsXG4gICAgICAgICAgICAgICAgICBjYW5jZWxhYmxlOiAhMCxcbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6XG4gICAgICAgICAgICAgICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiBlcnJvciAmJlxuICAgICAgICAgICAgICAgICAgICBudWxsICE9PSBlcnJvciAmJlxuICAgICAgICAgICAgICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2YgZXJyb3IubWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICAgID8gU3RyaW5nKGVycm9yLm1lc3NhZ2UpXG4gICAgICAgICAgICAgICAgICAgICAgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCF3aW5kb3cuZGlzcGF0Y2hFdmVudChldmVudCkpIHJldHVybjtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2YgcHJvY2VzcyAmJlxuICAgICAgICAgICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHByb2Nlc3MuZW1pdFxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzLmVtaXQoXCJ1bmNhdWdodEV4Y2VwdGlvblwiLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSxcbiAgICAgIGRpZFdhcm5BYm91dE1lc3NhZ2VDaGFubmVsID0gITEsXG4gICAgICBlbnF1ZXVlVGFza0ltcGwgPSBudWxsLFxuICAgICAgYWN0U2NvcGVEZXB0aCA9IDAsXG4gICAgICBkaWRXYXJuTm9Bd2FpdEFjdCA9ICExLFxuICAgICAgaXNGbHVzaGluZyA9ICExLFxuICAgICAgcXVldWVTZXZlcmFsTWljcm90YXNrcyA9XG4gICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHF1ZXVlTWljcm90YXNrXG4gICAgICAgICAgPyBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgcXVldWVNaWNyb3Rhc2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBxdWV1ZU1pY3JvdGFzayhjYWxsYmFjayk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIDogZW5xdWV1ZVRhc2s7XG4gICAgZGVwcmVjYXRlZEFQSXMgPSBPYmplY3QuZnJlZXplKHtcbiAgICAgIF9fcHJvdG9fXzogbnVsbCxcbiAgICAgIGM6IGZ1bmN0aW9uIChzaXplKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZU1lbW9DYWNoZShzaXplKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB2YXIgZm5OYW1lID0ge1xuICAgICAgbWFwOiBtYXBDaGlsZHJlbixcbiAgICAgIGZvckVhY2g6IGZ1bmN0aW9uIChjaGlsZHJlbiwgZm9yRWFjaEZ1bmMsIGZvckVhY2hDb250ZXh0KSB7XG4gICAgICAgIG1hcENoaWxkcmVuKFxuICAgICAgICAgIGNoaWxkcmVuLFxuICAgICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZvckVhY2hGdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBmb3JFYWNoQ29udGV4dFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIGNvdW50OiBmdW5jdGlvbiAoY2hpbGRyZW4pIHtcbiAgICAgICAgdmFyIG4gPSAwO1xuICAgICAgICBtYXBDaGlsZHJlbihjaGlsZHJlbiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIG4rKztcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBuO1xuICAgICAgfSxcbiAgICAgIHRvQXJyYXk6IGZ1bmN0aW9uIChjaGlsZHJlbikge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIG1hcENoaWxkcmVuKGNoaWxkcmVuLCBmdW5jdGlvbiAoY2hpbGQpIHtcbiAgICAgICAgICAgIHJldHVybiBjaGlsZDtcbiAgICAgICAgICB9KSB8fCBbXVxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIG9ubHk6IGZ1bmN0aW9uIChjaGlsZHJlbikge1xuICAgICAgICBpZiAoIWlzVmFsaWRFbGVtZW50KGNoaWxkcmVuKSlcbiAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgIFwiUmVhY3QuQ2hpbGRyZW4ub25seSBleHBlY3RlZCB0byByZWNlaXZlIGEgc2luZ2xlIFJlYWN0IGVsZW1lbnQgY2hpbGQuXCJcbiAgICAgICAgICApO1xuICAgICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgICB9XG4gICAgfTtcbiAgICBleHBvcnRzLkFjdGl2aXR5ID0gUkVBQ1RfQUNUSVZJVFlfVFlQRTtcbiAgICBleHBvcnRzLkNoaWxkcmVuID0gZm5OYW1lO1xuICAgIGV4cG9ydHMuQ29tcG9uZW50ID0gQ29tcG9uZW50O1xuICAgIGV4cG9ydHMuRnJhZ21lbnQgPSBSRUFDVF9GUkFHTUVOVF9UWVBFO1xuICAgIGV4cG9ydHMuUHJvZmlsZXIgPSBSRUFDVF9QUk9GSUxFUl9UWVBFO1xuICAgIGV4cG9ydHMuUHVyZUNvbXBvbmVudCA9IFB1cmVDb21wb25lbnQ7XG4gICAgZXhwb3J0cy5TdHJpY3RNb2RlID0gUkVBQ1RfU1RSSUNUX01PREVfVFlQRTtcbiAgICBleHBvcnRzLlN1c3BlbnNlID0gUkVBQ1RfU1VTUEVOU0VfVFlQRTtcbiAgICBleHBvcnRzLl9fQ0xJRU5UX0lOVEVSTkFMU19ET19OT1RfVVNFX09SX1dBUk5fVVNFUlNfVEhFWV9DQU5OT1RfVVBHUkFERSA9XG4gICAgICBSZWFjdFNoYXJlZEludGVybmFscztcbiAgICBleHBvcnRzLl9fQ09NUElMRVJfUlVOVElNRSA9IGRlcHJlY2F0ZWRBUElzO1xuICAgIGV4cG9ydHMuYWN0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICB2YXIgcHJldkFjdFF1ZXVlID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuYWN0UXVldWUsXG4gICAgICAgIHByZXZBY3RTY29wZURlcHRoID0gYWN0U2NvcGVEZXB0aDtcbiAgICAgIGFjdFNjb3BlRGVwdGgrKztcbiAgICAgIHZhciBxdWV1ZSA9IChSZWFjdFNoYXJlZEludGVybmFscy5hY3RRdWV1ZSA9XG4gICAgICAgICAgbnVsbCAhPT0gcHJldkFjdFF1ZXVlID8gcHJldkFjdFF1ZXVlIDogW10pLFxuICAgICAgICBkaWRBd2FpdEFjdENhbGwgPSAhMTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBjYWxsYmFjaygpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLnB1c2goZXJyb3IpO1xuICAgICAgfVxuICAgICAgaWYgKDAgPCBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoKVxuICAgICAgICB0aHJvdyAoXG4gICAgICAgICAgKHBvcEFjdFNjb3BlKHByZXZBY3RRdWV1ZSwgcHJldkFjdFNjb3BlRGVwdGgpLFxuICAgICAgICAgIChjYWxsYmFjayA9IGFnZ3JlZ2F0ZUVycm9ycyhSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMpKSxcbiAgICAgICAgICAoUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aCA9IDApLFxuICAgICAgICAgIGNhbGxiYWNrKVxuICAgICAgICApO1xuICAgICAgaWYgKFxuICAgICAgICBudWxsICE9PSByZXN1bHQgJiZcbiAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHJlc3VsdCAmJlxuICAgICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiByZXN1bHQudGhlblxuICAgICAgKSB7XG4gICAgICAgIHZhciB0aGVuYWJsZSA9IHJlc3VsdDtcbiAgICAgICAgcXVldWVTZXZlcmFsTWljcm90YXNrcyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgZGlkQXdhaXRBY3RDYWxsIHx8XG4gICAgICAgICAgICBkaWRXYXJuTm9Bd2FpdEFjdCB8fFxuICAgICAgICAgICAgKChkaWRXYXJuTm9Bd2FpdEFjdCA9ICEwKSxcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwiWW91IGNhbGxlZCBhY3QoYXN5bmMgKCkgPT4gLi4uKSB3aXRob3V0IGF3YWl0LiBUaGlzIGNvdWxkIGxlYWQgdG8gdW5leHBlY3RlZCB0ZXN0aW5nIGJlaGF2aW91ciwgaW50ZXJsZWF2aW5nIG11bHRpcGxlIGFjdCBjYWxscyBhbmQgbWl4aW5nIHRoZWlyIHNjb3Blcy4gWW91IHNob3VsZCAtIGF3YWl0IGFjdChhc3luYyAoKSA9PiAuLi4pO1wiXG4gICAgICAgICAgICApKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdGhlbjogZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgZGlkQXdhaXRBY3RDYWxsID0gITA7XG4gICAgICAgICAgICB0aGVuYWJsZS50aGVuKFxuICAgICAgICAgICAgICBmdW5jdGlvbiAocmV0dXJuVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBwb3BBY3RTY29wZShwcmV2QWN0UXVldWUsIHByZXZBY3RTY29wZURlcHRoKTtcbiAgICAgICAgICAgICAgICBpZiAoMCA9PT0gcHJldkFjdFNjb3BlRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGZsdXNoQWN0UXVldWUocXVldWUpLFxuICAgICAgICAgICAgICAgICAgICAgIGVucXVldWVUYXNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZWN1cnNpdmVseUZsdXNoQXN5bmNBY3RXb3JrKFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5WYWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IkMCkge1xuICAgICAgICAgICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMucHVzaChlcnJvciQwKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmICgwIDwgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgX3Rocm93bkVycm9yID0gYWdncmVnYXRlRXJyb3JzKFxuICAgICAgICAgICAgICAgICAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9yc1xuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KF90aHJvd25FcnJvcik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHJlc29sdmUocmV0dXJuVmFsdWUpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBwb3BBY3RTY29wZShwcmV2QWN0UXVldWUsIHByZXZBY3RTY29wZURlcHRoKTtcbiAgICAgICAgICAgICAgICAwIDwgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aFxuICAgICAgICAgICAgICAgICAgPyAoKGVycm9yID0gYWdncmVnYXRlRXJyb3JzKFxuICAgICAgICAgICAgICAgICAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9yc1xuICAgICAgICAgICAgICAgICAgICApKSxcbiAgICAgICAgICAgICAgICAgICAgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGggPSAwKSxcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKSlcbiAgICAgICAgICAgICAgICAgIDogcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB2YXIgcmV0dXJuVmFsdWUkanNjb21wJDAgPSByZXN1bHQ7XG4gICAgICBwb3BBY3RTY29wZShwcmV2QWN0UXVldWUsIHByZXZBY3RTY29wZURlcHRoKTtcbiAgICAgIDAgPT09IHByZXZBY3RTY29wZURlcHRoICYmXG4gICAgICAgIChmbHVzaEFjdFF1ZXVlKHF1ZXVlKSxcbiAgICAgICAgMCAhPT0gcXVldWUubGVuZ3RoICYmXG4gICAgICAgICAgcXVldWVTZXZlcmFsTWljcm90YXNrcyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkaWRBd2FpdEFjdENhbGwgfHxcbiAgICAgICAgICAgICAgZGlkV2Fybk5vQXdhaXRBY3QgfHxcbiAgICAgICAgICAgICAgKChkaWRXYXJuTm9Bd2FpdEFjdCA9ICEwKSxcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgICBcIkEgY29tcG9uZW50IHN1c3BlbmRlZCBpbnNpZGUgYW4gYGFjdGAgc2NvcGUsIGJ1dCB0aGUgYGFjdGAgY2FsbCB3YXMgbm90IGF3YWl0ZWQuIFdoZW4gdGVzdGluZyBSZWFjdCBjb21wb25lbnRzIHRoYXQgZGVwZW5kIG9uIGFzeW5jaHJvbm91cyBkYXRhLCB5b3UgbXVzdCBhd2FpdCB0aGUgcmVzdWx0OlxcblxcbmF3YWl0IGFjdCgoKSA9PiAuLi4pXCJcbiAgICAgICAgICAgICAgKSk7XG4gICAgICAgICAgfSksXG4gICAgICAgIChSZWFjdFNoYXJlZEludGVybmFscy5hY3RRdWV1ZSA9IG51bGwpKTtcbiAgICAgIGlmICgwIDwgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aClcbiAgICAgICAgdGhyb3cgKFxuICAgICAgICAgICgoY2FsbGJhY2sgPSBhZ2dyZWdhdGVFcnJvcnMoUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzKSksXG4gICAgICAgICAgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGggPSAwKSxcbiAgICAgICAgICBjYWxsYmFjaylcbiAgICAgICAgKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRoZW46IGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICBkaWRBd2FpdEFjdENhbGwgPSAhMDtcbiAgICAgICAgICAwID09PSBwcmV2QWN0U2NvcGVEZXB0aFxuICAgICAgICAgICAgPyAoKFJlYWN0U2hhcmVkSW50ZXJuYWxzLmFjdFF1ZXVlID0gcXVldWUpLFxuICAgICAgICAgICAgICBlbnF1ZXVlVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlY3Vyc2l2ZWx5Rmx1c2hBc3luY0FjdFdvcmsoXG4gICAgICAgICAgICAgICAgICByZXR1cm5WYWx1ZSRqc2NvbXAkMCxcbiAgICAgICAgICAgICAgICAgIHJlc29sdmUsXG4gICAgICAgICAgICAgICAgICByZWplY3RcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIDogcmVzb2x2ZShyZXR1cm5WYWx1ZSRqc2NvbXAkMCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfTtcbiAgICBleHBvcnRzLmNhY2hlID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfTtcbiAgICBleHBvcnRzLmNhY2hlU2lnbmFsID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcbiAgICBleHBvcnRzLmNhcHR1cmVPd25lclN0YWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGdldEN1cnJlbnRTdGFjayA9IFJlYWN0U2hhcmVkSW50ZXJuYWxzLmdldEN1cnJlbnRTdGFjaztcbiAgICAgIHJldHVybiBudWxsID09PSBnZXRDdXJyZW50U3RhY2sgPyBudWxsIDogZ2V0Q3VycmVudFN0YWNrKCk7XG4gICAgfTtcbiAgICBleHBvcnRzLmNsb25lRWxlbWVudCA9IGZ1bmN0aW9uIChlbGVtZW50LCBjb25maWcsIGNoaWxkcmVuKSB7XG4gICAgICBpZiAobnVsbCA9PT0gZWxlbWVudCB8fCB2b2lkIDAgPT09IGVsZW1lbnQpXG4gICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgIFwiVGhlIGFyZ3VtZW50IG11c3QgYmUgYSBSZWFjdCBlbGVtZW50LCBidXQgeW91IHBhc3NlZCBcIiArXG4gICAgICAgICAgICBlbGVtZW50ICtcbiAgICAgICAgICAgIFwiLlwiXG4gICAgICAgICk7XG4gICAgICB2YXIgcHJvcHMgPSBhc3NpZ24oe30sIGVsZW1lbnQucHJvcHMpLFxuICAgICAgICBrZXkgPSBlbGVtZW50LmtleSxcbiAgICAgICAgb3duZXIgPSBlbGVtZW50Ll9vd25lcjtcbiAgICAgIGlmIChudWxsICE9IGNvbmZpZykge1xuICAgICAgICB2YXIgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0O1xuICAgICAgICBhOiB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgaGFzT3duUHJvcGVydHkuY2FsbChjb25maWcsIFwicmVmXCIpICYmXG4gICAgICAgICAgICAoSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihcbiAgICAgICAgICAgICAgY29uZmlnLFxuICAgICAgICAgICAgICBcInJlZlwiXG4gICAgICAgICAgICApLmdldCkgJiZcbiAgICAgICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdC5pc1JlYWN0V2FybmluZ1xuICAgICAgICAgICkge1xuICAgICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gITE7XG4gICAgICAgICAgICBicmVhayBhO1xuICAgICAgICAgIH1cbiAgICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQgPSB2b2lkIDAgIT09IGNvbmZpZy5yZWY7XG4gICAgICAgIH1cbiAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ICYmIChvd25lciA9IGdldE93bmVyKCkpO1xuICAgICAgICBoYXNWYWxpZEtleShjb25maWcpICYmXG4gICAgICAgICAgKGNoZWNrS2V5U3RyaW5nQ29lcmNpb24oY29uZmlnLmtleSksIChrZXkgPSBcIlwiICsgY29uZmlnLmtleSkpO1xuICAgICAgICBmb3IgKHByb3BOYW1lIGluIGNvbmZpZylcbiAgICAgICAgICAhaGFzT3duUHJvcGVydHkuY2FsbChjb25maWcsIHByb3BOYW1lKSB8fFxuICAgICAgICAgICAgXCJrZXlcIiA9PT0gcHJvcE5hbWUgfHxcbiAgICAgICAgICAgIFwiX19zZWxmXCIgPT09IHByb3BOYW1lIHx8XG4gICAgICAgICAgICBcIl9fc291cmNlXCIgPT09IHByb3BOYW1lIHx8XG4gICAgICAgICAgICAoXCJyZWZcIiA9PT0gcHJvcE5hbWUgJiYgdm9pZCAwID09PSBjb25maWcucmVmKSB8fFxuICAgICAgICAgICAgKHByb3BzW3Byb3BOYW1lXSA9IGNvbmZpZ1twcm9wTmFtZV0pO1xuICAgICAgfVxuICAgICAgdmFyIHByb3BOYW1lID0gYXJndW1lbnRzLmxlbmd0aCAtIDI7XG4gICAgICBpZiAoMSA9PT0gcHJvcE5hbWUpIHByb3BzLmNoaWxkcmVuID0gY2hpbGRyZW47XG4gICAgICBlbHNlIGlmICgxIDwgcHJvcE5hbWUpIHtcbiAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gQXJyYXkocHJvcE5hbWUpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BOYW1lOyBpKyspXG4gICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0W2ldID0gYXJndW1lbnRzW2kgKyAyXTtcbiAgICAgICAgcHJvcHMuY2hpbGRyZW4gPSBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQ7XG4gICAgICB9XG4gICAgICBwcm9wcyA9IFJlYWN0RWxlbWVudChcbiAgICAgICAgZWxlbWVudC50eXBlLFxuICAgICAgICBrZXksXG4gICAgICAgIHByb3BzLFxuICAgICAgICBvd25lcixcbiAgICAgICAgZWxlbWVudC5fZGVidWdTdGFjayxcbiAgICAgICAgZWxlbWVudC5fZGVidWdUYXNrXG4gICAgICApO1xuICAgICAgZm9yIChrZXkgPSAyOyBrZXkgPCBhcmd1bWVudHMubGVuZ3RoOyBrZXkrKylcbiAgICAgICAgdmFsaWRhdGVDaGlsZEtleXMoYXJndW1lbnRzW2tleV0pO1xuICAgICAgcmV0dXJuIHByb3BzO1xuICAgIH07XG4gICAgZXhwb3J0cy5jcmVhdGVDb250ZXh0ID0gZnVuY3Rpb24gKGRlZmF1bHRWYWx1ZSkge1xuICAgICAgZGVmYXVsdFZhbHVlID0ge1xuICAgICAgICAkJHR5cGVvZjogUkVBQ1RfQ09OVEVYVF9UWVBFLFxuICAgICAgICBfY3VycmVudFZhbHVlOiBkZWZhdWx0VmFsdWUsXG4gICAgICAgIF9jdXJyZW50VmFsdWUyOiBkZWZhdWx0VmFsdWUsXG4gICAgICAgIF90aHJlYWRDb3VudDogMCxcbiAgICAgICAgUHJvdmlkZXI6IG51bGwsXG4gICAgICAgIENvbnN1bWVyOiBudWxsXG4gICAgICB9O1xuICAgICAgZGVmYXVsdFZhbHVlLlByb3ZpZGVyID0gZGVmYXVsdFZhbHVlO1xuICAgICAgZGVmYXVsdFZhbHVlLkNvbnN1bWVyID0ge1xuICAgICAgICAkJHR5cGVvZjogUkVBQ1RfQ09OU1VNRVJfVFlQRSxcbiAgICAgICAgX2NvbnRleHQ6IGRlZmF1bHRWYWx1ZVxuICAgICAgfTtcbiAgICAgIGRlZmF1bHRWYWx1ZS5fY3VycmVudFJlbmRlcmVyID0gbnVsbDtcbiAgICAgIGRlZmF1bHRWYWx1ZS5fY3VycmVudFJlbmRlcmVyMiA9IG51bGw7XG4gICAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgIH07XG4gICAgZXhwb3J0cy5jcmVhdGVFbGVtZW50ID0gZnVuY3Rpb24gKHR5cGUsIGNvbmZpZywgY2hpbGRyZW4pIHtcbiAgICAgIGZvciAodmFyIGkgPSAyOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxuICAgICAgICB2YWxpZGF0ZUNoaWxkS2V5cyhhcmd1bWVudHNbaV0pO1xuICAgICAgaSA9IHt9O1xuICAgICAgdmFyIGtleSA9IG51bGw7XG4gICAgICBpZiAobnVsbCAhPSBjb25maWcpXG4gICAgICAgIGZvciAocHJvcE5hbWUgaW4gKGRpZFdhcm5BYm91dE9sZEpTWFJ1bnRpbWUgfHxcbiAgICAgICAgICAhKFwiX19zZWxmXCIgaW4gY29uZmlnKSB8fFxuICAgICAgICAgIFwia2V5XCIgaW4gY29uZmlnIHx8XG4gICAgICAgICAgKChkaWRXYXJuQWJvdXRPbGRKU1hSdW50aW1lID0gITApLFxuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIFwiWW91ciBhcHAgKG9yIG9uZSBvZiBpdHMgZGVwZW5kZW5jaWVzKSBpcyB1c2luZyBhbiBvdXRkYXRlZCBKU1ggdHJhbnNmb3JtLiBVcGRhdGUgdG8gdGhlIG1vZGVybiBKU1ggdHJhbnNmb3JtIGZvciBmYXN0ZXIgcGVyZm9ybWFuY2U6IGh0dHBzOi8vcmVhY3QuZGV2L2xpbmsvbmV3LWpzeC10cmFuc2Zvcm1cIlxuICAgICAgICAgICkpLFxuICAgICAgICBoYXNWYWxpZEtleShjb25maWcpICYmXG4gICAgICAgICAgKGNoZWNrS2V5U3RyaW5nQ29lcmNpb24oY29uZmlnLmtleSksIChrZXkgPSBcIlwiICsgY29uZmlnLmtleSkpLFxuICAgICAgICBjb25maWcpKVxuICAgICAgICAgIGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBwcm9wTmFtZSkgJiZcbiAgICAgICAgICAgIFwia2V5XCIgIT09IHByb3BOYW1lICYmXG4gICAgICAgICAgICBcIl9fc2VsZlwiICE9PSBwcm9wTmFtZSAmJlxuICAgICAgICAgICAgXCJfX3NvdXJjZVwiICE9PSBwcm9wTmFtZSAmJlxuICAgICAgICAgICAgKGlbcHJvcE5hbWVdID0gY29uZmlnW3Byb3BOYW1lXSk7XG4gICAgICB2YXIgY2hpbGRyZW5MZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoIC0gMjtcbiAgICAgIGlmICgxID09PSBjaGlsZHJlbkxlbmd0aCkgaS5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgICAgZWxzZSBpZiAoMSA8IGNoaWxkcmVuTGVuZ3RoKSB7XG4gICAgICAgIGZvciAoXG4gICAgICAgICAgdmFyIGNoaWxkQXJyYXkgPSBBcnJheShjaGlsZHJlbkxlbmd0aCksIF9pID0gMDtcbiAgICAgICAgICBfaSA8IGNoaWxkcmVuTGVuZ3RoO1xuICAgICAgICAgIF9pKytcbiAgICAgICAgKVxuICAgICAgICAgIGNoaWxkQXJyYXlbX2ldID0gYXJndW1lbnRzW19pICsgMl07XG4gICAgICAgIE9iamVjdC5mcmVlemUgJiYgT2JqZWN0LmZyZWV6ZShjaGlsZEFycmF5KTtcbiAgICAgICAgaS5jaGlsZHJlbiA9IGNoaWxkQXJyYXk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZSAmJiB0eXBlLmRlZmF1bHRQcm9wcylcbiAgICAgICAgZm9yIChwcm9wTmFtZSBpbiAoKGNoaWxkcmVuTGVuZ3RoID0gdHlwZS5kZWZhdWx0UHJvcHMpLCBjaGlsZHJlbkxlbmd0aCkpXG4gICAgICAgICAgdm9pZCAwID09PSBpW3Byb3BOYW1lXSAmJiAoaVtwcm9wTmFtZV0gPSBjaGlsZHJlbkxlbmd0aFtwcm9wTmFtZV0pO1xuICAgICAga2V5ICYmXG4gICAgICAgIGRlZmluZUtleVByb3BXYXJuaW5nR2V0dGVyKFxuICAgICAgICAgIGksXG4gICAgICAgICAgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgdHlwZVxuICAgICAgICAgICAgPyB0eXBlLmRpc3BsYXlOYW1lIHx8IHR5cGUubmFtZSB8fCBcIlVua25vd25cIlxuICAgICAgICAgICAgOiB0eXBlXG4gICAgICAgICk7XG4gICAgICB2YXIgcHJvcE5hbWUgPSAxZTQgPiBSZWFjdFNoYXJlZEludGVybmFscy5yZWNlbnRseUNyZWF0ZWRPd25lclN0YWNrcysrO1xuICAgICAgcmV0dXJuIFJlYWN0RWxlbWVudChcbiAgICAgICAgdHlwZSxcbiAgICAgICAga2V5LFxuICAgICAgICBpLFxuICAgICAgICBnZXRPd25lcigpLFxuICAgICAgICBwcm9wTmFtZSA/IEVycm9yKFwicmVhY3Qtc3RhY2stdG9wLWZyYW1lXCIpIDogdW5rbm93bk93bmVyRGVidWdTdGFjayxcbiAgICAgICAgcHJvcE5hbWUgPyBjcmVhdGVUYXNrKGdldFRhc2tOYW1lKHR5cGUpKSA6IHVua25vd25Pd25lckRlYnVnVGFza1xuICAgICAgKTtcbiAgICB9O1xuICAgIGV4cG9ydHMuY3JlYXRlUmVmID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHJlZk9iamVjdCA9IHsgY3VycmVudDogbnVsbCB9O1xuICAgICAgT2JqZWN0LnNlYWwocmVmT2JqZWN0KTtcbiAgICAgIHJldHVybiByZWZPYmplY3Q7XG4gICAgfTtcbiAgICBleHBvcnRzLmZvcndhcmRSZWYgPSBmdW5jdGlvbiAocmVuZGVyKSB7XG4gICAgICBudWxsICE9IHJlbmRlciAmJiByZW5kZXIuJCR0eXBlb2YgPT09IFJFQUNUX01FTU9fVFlQRVxuICAgICAgICA/IGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBcImZvcndhcmRSZWYgcmVxdWlyZXMgYSByZW5kZXIgZnVuY3Rpb24gYnV0IHJlY2VpdmVkIGEgYG1lbW9gIGNvbXBvbmVudC4gSW5zdGVhZCBvZiBmb3J3YXJkUmVmKG1lbW8oLi4uKSksIHVzZSBtZW1vKGZvcndhcmRSZWYoLi4uKSkuXCJcbiAgICAgICAgICApXG4gICAgICAgIDogXCJmdW5jdGlvblwiICE9PSB0eXBlb2YgcmVuZGVyXG4gICAgICAgICAgPyBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcImZvcndhcmRSZWYgcmVxdWlyZXMgYSByZW5kZXIgZnVuY3Rpb24gYnV0IHdhcyBnaXZlbiAlcy5cIixcbiAgICAgICAgICAgICAgbnVsbCA9PT0gcmVuZGVyID8gXCJudWxsXCIgOiB0eXBlb2YgcmVuZGVyXG4gICAgICAgICAgICApXG4gICAgICAgICAgOiAwICE9PSByZW5kZXIubGVuZ3RoICYmXG4gICAgICAgICAgICAyICE9PSByZW5kZXIubGVuZ3RoICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcImZvcndhcmRSZWYgcmVuZGVyIGZ1bmN0aW9ucyBhY2NlcHQgZXhhY3RseSB0d28gcGFyYW1ldGVyczogcHJvcHMgYW5kIHJlZi4gJXNcIixcbiAgICAgICAgICAgICAgMSA9PT0gcmVuZGVyLmxlbmd0aFxuICAgICAgICAgICAgICAgID8gXCJEaWQgeW91IGZvcmdldCB0byB1c2UgdGhlIHJlZiBwYXJhbWV0ZXI/XCJcbiAgICAgICAgICAgICAgICA6IFwiQW55IGFkZGl0aW9uYWwgcGFyYW1ldGVyIHdpbGwgYmUgdW5kZWZpbmVkLlwiXG4gICAgICAgICAgICApO1xuICAgICAgbnVsbCAhPSByZW5kZXIgJiZcbiAgICAgICAgbnVsbCAhPSByZW5kZXIuZGVmYXVsdFByb3BzICYmXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJmb3J3YXJkUmVmIHJlbmRlciBmdW5jdGlvbnMgZG8gbm90IHN1cHBvcnQgZGVmYXVsdFByb3BzLiBEaWQgeW91IGFjY2lkZW50YWxseSBwYXNzIGEgUmVhY3QgY29tcG9uZW50P1wiXG4gICAgICAgICk7XG4gICAgICB2YXIgZWxlbWVudFR5cGUgPSB7ICQkdHlwZW9mOiBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFLCByZW5kZXI6IHJlbmRlciB9LFxuICAgICAgICBvd25OYW1lO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGVsZW1lbnRUeXBlLCBcImRpc3BsYXlOYW1lXCIsIHtcbiAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITAsXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBvd25OYW1lO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgb3duTmFtZSA9IG5hbWU7XG4gICAgICAgICAgcmVuZGVyLm5hbWUgfHxcbiAgICAgICAgICAgIHJlbmRlci5kaXNwbGF5TmFtZSB8fFxuICAgICAgICAgICAgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZW5kZXIsIFwibmFtZVwiLCB7IHZhbHVlOiBuYW1lIH0pLFxuICAgICAgICAgICAgKHJlbmRlci5kaXNwbGF5TmFtZSA9IG5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gZWxlbWVudFR5cGU7XG4gICAgfTtcbiAgICBleHBvcnRzLmlzVmFsaWRFbGVtZW50ID0gaXNWYWxpZEVsZW1lbnQ7XG4gICAgZXhwb3J0cy5sYXp5ID0gZnVuY3Rpb24gKGN0b3IpIHtcbiAgICAgIGN0b3IgPSB7IF9zdGF0dXM6IC0xLCBfcmVzdWx0OiBjdG9yIH07XG4gICAgICB2YXIgbGF6eVR5cGUgPSB7XG4gICAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0xBWllfVFlQRSxcbiAgICAgICAgICBfcGF5bG9hZDogY3RvcixcbiAgICAgICAgICBfaW5pdDogbGF6eUluaXRpYWxpemVyXG4gICAgICAgIH0sXG4gICAgICAgIGlvSW5mbyA9IHtcbiAgICAgICAgICBuYW1lOiBcImxhenlcIixcbiAgICAgICAgICBzdGFydDogLTEsXG4gICAgICAgICAgZW5kOiAtMSxcbiAgICAgICAgICB2YWx1ZTogbnVsbCxcbiAgICAgICAgICBvd25lcjogbnVsbCxcbiAgICAgICAgICBkZWJ1Z1N0YWNrOiBFcnJvcihcInJlYWN0LXN0YWNrLXRvcC1mcmFtZVwiKSxcbiAgICAgICAgICBkZWJ1Z1Rhc2s6IGNvbnNvbGUuY3JlYXRlVGFzayA/IGNvbnNvbGUuY3JlYXRlVGFzayhcImxhenkoKVwiKSA6IG51bGxcbiAgICAgICAgfTtcbiAgICAgIGN0b3IuX2lvSW5mbyA9IGlvSW5mbztcbiAgICAgIGxhenlUeXBlLl9kZWJ1Z0luZm8gPSBbeyBhd2FpdGVkOiBpb0luZm8gfV07XG4gICAgICByZXR1cm4gbGF6eVR5cGU7XG4gICAgfTtcbiAgICBleHBvcnRzLm1lbW8gPSBmdW5jdGlvbiAodHlwZSwgY29tcGFyZSkge1xuICAgICAgbnVsbCA9PSB0eXBlICYmXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJtZW1vOiBUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIGNvbXBvbmVudC4gSW5zdGVhZCByZWNlaXZlZDogJXNcIixcbiAgICAgICAgICBudWxsID09PSB0eXBlID8gXCJudWxsXCIgOiB0eXBlb2YgdHlwZVxuICAgICAgICApO1xuICAgICAgY29tcGFyZSA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX01FTU9fVFlQRSxcbiAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgY29tcGFyZTogdm9pZCAwID09PSBjb21wYXJlID8gbnVsbCA6IGNvbXBhcmVcbiAgICAgIH07XG4gICAgICB2YXIgb3duTmFtZTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb21wYXJlLCBcImRpc3BsYXlOYW1lXCIsIHtcbiAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITAsXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBvd25OYW1lO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgb3duTmFtZSA9IG5hbWU7XG4gICAgICAgICAgdHlwZS5uYW1lIHx8XG4gICAgICAgICAgICB0eXBlLmRpc3BsYXlOYW1lIHx8XG4gICAgICAgICAgICAoT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwibmFtZVwiLCB7IHZhbHVlOiBuYW1lIH0pLFxuICAgICAgICAgICAgKHR5cGUuZGlzcGxheU5hbWUgPSBuYW1lKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGNvbXBhcmU7XG4gICAgfTtcbiAgICBleHBvcnRzLnN0YXJ0VHJhbnNpdGlvbiA9IGZ1bmN0aW9uIChzY29wZSkge1xuICAgICAgdmFyIHByZXZUcmFuc2l0aW9uID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuVCxcbiAgICAgICAgY3VycmVudFRyYW5zaXRpb24gPSB7fTtcbiAgICAgIGN1cnJlbnRUcmFuc2l0aW9uLl91cGRhdGVkRmliZXJzID0gbmV3IFNldCgpO1xuICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMuVCA9IGN1cnJlbnRUcmFuc2l0aW9uO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIHJldHVyblZhbHVlID0gc2NvcGUoKSxcbiAgICAgICAgICBvblN0YXJ0VHJhbnNpdGlvbkZpbmlzaCA9IFJlYWN0U2hhcmVkSW50ZXJuYWxzLlM7XG4gICAgICAgIG51bGwgIT09IG9uU3RhcnRUcmFuc2l0aW9uRmluaXNoICYmXG4gICAgICAgICAgb25TdGFydFRyYW5zaXRpb25GaW5pc2goY3VycmVudFRyYW5zaXRpb24sIHJldHVyblZhbHVlKTtcbiAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHJldHVyblZhbHVlICYmXG4gICAgICAgICAgbnVsbCAhPT0gcmV0dXJuVmFsdWUgJiZcbiAgICAgICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiByZXR1cm5WYWx1ZS50aGVuICYmXG4gICAgICAgICAgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLmFzeW5jVHJhbnNpdGlvbnMrKyxcbiAgICAgICAgICByZXR1cm5WYWx1ZS50aGVuKHJlbGVhc2VBc3luY1RyYW5zaXRpb24sIHJlbGVhc2VBc3luY1RyYW5zaXRpb24pLFxuICAgICAgICAgIHJldHVyblZhbHVlLnRoZW4obm9vcCwgcmVwb3J0R2xvYmFsRXJyb3IpKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJlcG9ydEdsb2JhbEVycm9yKGVycm9yKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIG51bGwgPT09IHByZXZUcmFuc2l0aW9uICYmXG4gICAgICAgICAgY3VycmVudFRyYW5zaXRpb24uX3VwZGF0ZWRGaWJlcnMgJiZcbiAgICAgICAgICAoKHNjb3BlID0gY3VycmVudFRyYW5zaXRpb24uX3VwZGF0ZWRGaWJlcnMuc2l6ZSksXG4gICAgICAgICAgY3VycmVudFRyYW5zaXRpb24uX3VwZGF0ZWRGaWJlcnMuY2xlYXIoKSxcbiAgICAgICAgICAxMCA8IHNjb3BlICYmXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgIFwiRGV0ZWN0ZWQgYSBsYXJnZSBudW1iZXIgb2YgdXBkYXRlcyBpbnNpZGUgc3RhcnRUcmFuc2l0aW9uLiBJZiB0aGlzIGlzIGR1ZSB0byBhIHN1YnNjcmlwdGlvbiBwbGVhc2UgcmUtd3JpdGUgaXQgdG8gdXNlIFJlYWN0IHByb3ZpZGVkIGhvb2tzLiBPdGhlcndpc2UgY29uY3VycmVudCBtb2RlIGd1YXJhbnRlZXMgYXJlIG9mZiB0aGUgdGFibGUuXCJcbiAgICAgICAgICAgICkpLFxuICAgICAgICAgIG51bGwgIT09IHByZXZUcmFuc2l0aW9uICYmXG4gICAgICAgICAgICBudWxsICE9PSBjdXJyZW50VHJhbnNpdGlvbi50eXBlcyAmJlxuICAgICAgICAgICAgKG51bGwgIT09IHByZXZUcmFuc2l0aW9uLnR5cGVzICYmXG4gICAgICAgICAgICAgIHByZXZUcmFuc2l0aW9uLnR5cGVzICE9PSBjdXJyZW50VHJhbnNpdGlvbi50eXBlcyAmJlxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICAgIFwiV2UgZXhwZWN0ZWQgaW5uZXIgVHJhbnNpdGlvbnMgdG8gaGF2ZSB0cmFuc2ZlcnJlZCB0aGUgb3V0ZXIgdHlwZXMgc2V0IGFuZCB0aGF0IHlvdSBjYW5ub3QgYWRkIHRvIHRoZSBvdXRlciBUcmFuc2l0aW9uIHdoaWxlIGluc2lkZSB0aGUgaW5uZXIuVGhpcyBpcyBhIGJ1ZyBpbiBSZWFjdC5cIlxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKHByZXZUcmFuc2l0aW9uLnR5cGVzID0gY3VycmVudFRyYW5zaXRpb24udHlwZXMpKSxcbiAgICAgICAgICAoUmVhY3RTaGFyZWRJbnRlcm5hbHMuVCA9IHByZXZUcmFuc2l0aW9uKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGV4cG9ydHMudW5zdGFibGVfdXNlQ2FjaGVSZWZyZXNoID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlQ2FjaGVSZWZyZXNoKCk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZSA9IGZ1bmN0aW9uICh1c2FibGUpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZSh1c2FibGUpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VBY3Rpb25TdGF0ZSA9IGZ1bmN0aW9uIChhY3Rpb24sIGluaXRpYWxTdGF0ZSwgcGVybWFsaW5rKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VBY3Rpb25TdGF0ZShcbiAgICAgICAgYWN0aW9uLFxuICAgICAgICBpbml0aWFsU3RhdGUsXG4gICAgICAgIHBlcm1hbGlua1xuICAgICAgKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlQ2FsbGJhY2sgPSBmdW5jdGlvbiAoY2FsbGJhY2ssIGRlcHMpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUNhbGxiYWNrKGNhbGxiYWNrLCBkZXBzKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlQ29udGV4dCA9IGZ1bmN0aW9uIChDb250ZXh0KSB7XG4gICAgICB2YXIgZGlzcGF0Y2hlciA9IHJlc29sdmVEaXNwYXRjaGVyKCk7XG4gICAgICBDb250ZXh0LiQkdHlwZW9mID09PSBSRUFDVF9DT05TVU1FUl9UWVBFICYmXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJDYWxsaW5nIHVzZUNvbnRleHQoQ29udGV4dC5Db25zdW1lcikgaXMgbm90IHN1cHBvcnRlZCBhbmQgd2lsbCBjYXVzZSBidWdzLiBEaWQgeW91IG1lYW4gdG8gY2FsbCB1c2VDb250ZXh0KENvbnRleHQpIGluc3RlYWQ/XCJcbiAgICAgICAgKTtcbiAgICAgIHJldHVybiBkaXNwYXRjaGVyLnVzZUNvbnRleHQoQ29udGV4dCk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZURlYnVnVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUsIGZvcm1hdHRlckZuKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VEZWJ1Z1ZhbHVlKHZhbHVlLCBmb3JtYXR0ZXJGbik7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZURlZmVycmVkVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUsIGluaXRpYWxWYWx1ZSkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlRGVmZXJyZWRWYWx1ZSh2YWx1ZSwgaW5pdGlhbFZhbHVlKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlRWZmZWN0ID0gZnVuY3Rpb24gKGNyZWF0ZSwgZGVwcykge1xuICAgICAgbnVsbCA9PSBjcmVhdGUgJiZcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIFwiUmVhY3QgSG9vayB1c2VFZmZlY3QgcmVxdWlyZXMgYW4gZWZmZWN0IGNhbGxiYWNrLiBEaWQgeW91IGZvcmdldCB0byBwYXNzIGEgY2FsbGJhY2sgdG8gdGhlIGhvb2s/XCJcbiAgICAgICAgKTtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUVmZmVjdChjcmVhdGUsIGRlcHMpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VFZmZlY3RFdmVudCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlRWZmZWN0RXZlbnQoY2FsbGJhY2spO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VJZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUlkKCk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZUltcGVyYXRpdmVIYW5kbGUgPSBmdW5jdGlvbiAocmVmLCBjcmVhdGUsIGRlcHMpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUltcGVyYXRpdmVIYW5kbGUocmVmLCBjcmVhdGUsIGRlcHMpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VJbnNlcnRpb25FZmZlY3QgPSBmdW5jdGlvbiAoY3JlYXRlLCBkZXBzKSB7XG4gICAgICBudWxsID09IGNyZWF0ZSAmJlxuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgXCJSZWFjdCBIb29rIHVzZUluc2VydGlvbkVmZmVjdCByZXF1aXJlcyBhbiBlZmZlY3QgY2FsbGJhY2suIERpZCB5b3UgZm9yZ2V0IHRvIHBhc3MgYSBjYWxsYmFjayB0byB0aGUgaG9vaz9cIlxuICAgICAgICApO1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlSW5zZXJ0aW9uRWZmZWN0KGNyZWF0ZSwgZGVwcyk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZUxheW91dEVmZmVjdCA9IGZ1bmN0aW9uIChjcmVhdGUsIGRlcHMpIHtcbiAgICAgIG51bGwgPT0gY3JlYXRlICYmXG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBcIlJlYWN0IEhvb2sgdXNlTGF5b3V0RWZmZWN0IHJlcXVpcmVzIGFuIGVmZmVjdCBjYWxsYmFjay4gRGlkIHlvdSBmb3JnZXQgdG8gcGFzcyBhIGNhbGxiYWNrIHRvIHRoZSBob29rP1wiXG4gICAgICAgICk7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VMYXlvdXRFZmZlY3QoY3JlYXRlLCBkZXBzKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlTWVtbyA9IGZ1bmN0aW9uIChjcmVhdGUsIGRlcHMpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZU1lbW8oY3JlYXRlLCBkZXBzKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlT3B0aW1pc3RpYyA9IGZ1bmN0aW9uIChwYXNzdGhyb3VnaCwgcmVkdWNlcikge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlT3B0aW1pc3RpYyhwYXNzdGhyb3VnaCwgcmVkdWNlcik7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZVJlZHVjZXIgPSBmdW5jdGlvbiAocmVkdWNlciwgaW5pdGlhbEFyZywgaW5pdCkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlUmVkdWNlcihyZWR1Y2VyLCBpbml0aWFsQXJnLCBpbml0KTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlUmVmID0gZnVuY3Rpb24gKGluaXRpYWxWYWx1ZSkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlUmVmKGluaXRpYWxWYWx1ZSk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZVN0YXRlID0gZnVuY3Rpb24gKGluaXRpYWxTdGF0ZSkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlU3RhdGUoaW5pdGlhbFN0YXRlKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlU3luY0V4dGVybmFsU3RvcmUgPSBmdW5jdGlvbiAoXG4gICAgICBzdWJzY3JpYmUsXG4gICAgICBnZXRTbmFwc2hvdCxcbiAgICAgIGdldFNlcnZlclNuYXBzaG90XG4gICAgKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VTeW5jRXh0ZXJuYWxTdG9yZShcbiAgICAgICAgc3Vic2NyaWJlLFxuICAgICAgICBnZXRTbmFwc2hvdCxcbiAgICAgICAgZ2V0U2VydmVyU25hcHNob3RcbiAgICAgICk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZVRyYW5zaXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VUcmFuc2l0aW9uKCk7XG4gICAgfTtcbiAgICBleHBvcnRzLnZlcnNpb24gPSBcIjE5LjIuM1wiO1xuICAgIFwidW5kZWZpbmVkXCIgIT09IHR5cGVvZiBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18gJiZcbiAgICAgIFwiZnVuY3Rpb25cIiA9PT1cbiAgICAgICAgdHlwZW9mIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RvcCAmJlxuICAgICAgX19SRUFDVF9ERVZUT09MU19HTE9CQUxfSE9PS19fLnJlZ2lzdGVySW50ZXJuYWxNb2R1bGVTdG9wKEVycm9yKCkpO1xuICB9KSgpO1xuIiwKICAgICIndXNlIHN0cmljdCc7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QucHJvZHVjdGlvbi5qcycpO1xufSBlbHNlIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2Nqcy9yZWFjdC5kZXZlbG9wbWVudC5qcycpO1xufVxuIiwKICAgICIvKipcbiAqIEBsaWNlbnNlIFJlYWN0XG4gKiByZWFjdC1qc3gtcnVudGltZS5kZXZlbG9wbWVudC5qc1xuICpcbiAqIENvcHlyaWdodCAoYykgTWV0YSBQbGF0Zm9ybXMsIEluYy4gYW5kIGFmZmlsaWF0ZXMuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuXG4gKi9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cInByb2R1Y3Rpb25cIiAhPT0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgJiZcbiAgKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSkge1xuICAgICAgaWYgKG51bGwgPT0gdHlwZSkgcmV0dXJuIG51bGw7XG4gICAgICBpZiAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgdHlwZSlcbiAgICAgICAgcmV0dXJuIHR5cGUuJCR0eXBlb2YgPT09IFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0VcbiAgICAgICAgICA/IG51bGxcbiAgICAgICAgICA6IHR5cGUuZGlzcGxheU5hbWUgfHwgdHlwZS5uYW1lIHx8IG51bGw7XG4gICAgICBpZiAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIHR5cGUpIHJldHVybiB0eXBlO1xuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgUkVBQ1RfRlJBR01FTlRfVFlQRTpcbiAgICAgICAgICByZXR1cm4gXCJGcmFnbWVudFwiO1xuICAgICAgICBjYXNlIFJFQUNUX1BST0ZJTEVSX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiUHJvZmlsZXJcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN0cmljdE1vZGVcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVVNQRU5TRV9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN1c3BlbnNlXCI7XG4gICAgICAgIGNhc2UgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN1c3BlbnNlTGlzdFwiO1xuICAgICAgICBjYXNlIFJFQUNUX0FDVElWSVRZX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiQWN0aXZpdHlcIjtcbiAgICAgIH1cbiAgICAgIGlmIChcIm9iamVjdFwiID09PSB0eXBlb2YgdHlwZSlcbiAgICAgICAgc3dpdGNoIChcbiAgICAgICAgICAoXCJudW1iZXJcIiA9PT0gdHlwZW9mIHR5cGUudGFnICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcIlJlY2VpdmVkIGFuIHVuZXhwZWN0ZWQgb2JqZWN0IGluIGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSgpLiBUaGlzIGlzIGxpa2VseSBhIGJ1ZyBpbiBSZWFjdC4gUGxlYXNlIGZpbGUgYW4gaXNzdWUuXCJcbiAgICAgICAgICAgICksXG4gICAgICAgICAgdHlwZS4kJHR5cGVvZilcbiAgICAgICAgKSB7XG4gICAgICAgICAgY2FzZSBSRUFDVF9QT1JUQUxfVFlQRTpcbiAgICAgICAgICAgIHJldHVybiBcIlBvcnRhbFwiO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfQ09OVEVYVF9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIHR5cGUuZGlzcGxheU5hbWUgfHwgXCJDb250ZXh0XCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9DT05TVU1FUl9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuICh0eXBlLl9jb250ZXh0LmRpc3BsYXlOYW1lIHx8IFwiQ29udGV4dFwiKSArIFwiLkNvbnN1bWVyXCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFOlxuICAgICAgICAgICAgdmFyIGlubmVyVHlwZSA9IHR5cGUucmVuZGVyO1xuICAgICAgICAgICAgdHlwZSA9IHR5cGUuZGlzcGxheU5hbWU7XG4gICAgICAgICAgICB0eXBlIHx8XG4gICAgICAgICAgICAgICgodHlwZSA9IGlubmVyVHlwZS5kaXNwbGF5TmFtZSB8fCBpbm5lclR5cGUubmFtZSB8fCBcIlwiKSxcbiAgICAgICAgICAgICAgKHR5cGUgPSBcIlwiICE9PSB0eXBlID8gXCJGb3J3YXJkUmVmKFwiICsgdHlwZSArIFwiKVwiIDogXCJGb3J3YXJkUmVmXCIpKTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfTUVNT19UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgKGlubmVyVHlwZSA9IHR5cGUuZGlzcGxheU5hbWUgfHwgbnVsbCksXG4gICAgICAgICAgICAgIG51bGwgIT09IGlubmVyVHlwZVxuICAgICAgICAgICAgICAgID8gaW5uZXJUeXBlXG4gICAgICAgICAgICAgICAgOiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZS50eXBlKSB8fCBcIk1lbW9cIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICBjYXNlIFJFQUNUX0xBWllfVFlQRTpcbiAgICAgICAgICAgIGlubmVyVHlwZSA9IHR5cGUuX3BheWxvYWQ7XG4gICAgICAgICAgICB0eXBlID0gdHlwZS5faW5pdDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZShpbm5lclR5cGUpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHgpIHt9XG4gICAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0ZXN0U3RyaW5nQ29lcmNpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiBcIlwiICsgdmFsdWU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNoZWNrS2V5U3RyaW5nQ29lcmNpb24odmFsdWUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRlc3RTdHJpbmdDb2VyY2lvbih2YWx1ZSk7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQgPSAhMTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gITA7XG4gICAgICB9XG4gICAgICBpZiAoSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0KSB7XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9IGNvbnNvbGU7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX3RlbXBfY29uc3QgPSBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQuZXJyb3I7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQkanNjb21wJDAgPVxuICAgICAgICAgIChcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBTeW1ib2wgJiZcbiAgICAgICAgICAgIFN5bWJvbC50b1N0cmluZ1RhZyAmJlxuICAgICAgICAgICAgdmFsdWVbU3ltYm9sLnRvU3RyaW5nVGFnXSkgfHxcbiAgICAgICAgICB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lIHx8XG4gICAgICAgICAgXCJPYmplY3RcIjtcbiAgICAgICAgSlNDb21waWxlcl90ZW1wX2NvbnN0LmNhbGwoXG4gICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0LFxuICAgICAgICAgIFwiVGhlIHByb3ZpZGVkIGtleSBpcyBhbiB1bnN1cHBvcnRlZCB0eXBlICVzLiBUaGlzIHZhbHVlIG11c3QgYmUgY29lcmNlZCB0byBhIHN0cmluZyBiZWZvcmUgdXNpbmcgaXQgaGVyZS5cIixcbiAgICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQkanNjb21wJDBcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHRlc3RTdHJpbmdDb2VyY2lvbih2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldFRhc2tOYW1lKHR5cGUpIHtcbiAgICAgIGlmICh0eXBlID09PSBSRUFDVF9GUkFHTUVOVF9UWVBFKSByZXR1cm4gXCI8PlwiO1xuICAgICAgaWYgKFxuICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2YgdHlwZSAmJlxuICAgICAgICBudWxsICE9PSB0eXBlICYmXG4gICAgICAgIHR5cGUuJCR0eXBlb2YgPT09IFJFQUNUX0xBWllfVFlQRVxuICAgICAgKVxuICAgICAgICByZXR1cm4gXCI8Li4uPlwiO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIG5hbWUgPSBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSk7XG4gICAgICAgIHJldHVybiBuYW1lID8gXCI8XCIgKyBuYW1lICsgXCI+XCIgOiBcIjwuLi4+XCI7XG4gICAgICB9IGNhdGNoICh4KSB7XG4gICAgICAgIHJldHVybiBcIjwuLi4+XCI7XG4gICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldE93bmVyKCkge1xuICAgICAgdmFyIGRpc3BhdGNoZXIgPSBSZWFjdFNoYXJlZEludGVybmFscy5BO1xuICAgICAgcmV0dXJuIG51bGwgPT09IGRpc3BhdGNoZXIgPyBudWxsIDogZGlzcGF0Y2hlci5nZXRPd25lcigpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBVbmtub3duT3duZXIoKSB7XG4gICAgICByZXR1cm4gRXJyb3IoXCJyZWFjdC1zdGFjay10b3AtZnJhbWVcIik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGhhc1ZhbGlkS2V5KGNvbmZpZykge1xuICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBcImtleVwiKSkge1xuICAgICAgICB2YXIgZ2V0dGVyID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihjb25maWcsIFwia2V5XCIpLmdldDtcbiAgICAgICAgaWYgKGdldHRlciAmJiBnZXR0ZXIuaXNSZWFjdFdhcm5pbmcpIHJldHVybiAhMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2b2lkIDAgIT09IGNvbmZpZy5rZXk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRlZmluZUtleVByb3BXYXJuaW5nR2V0dGVyKHByb3BzLCBkaXNwbGF5TmFtZSkge1xuICAgICAgZnVuY3Rpb24gd2FybkFib3V0QWNjZXNzaW5nS2V5KCkge1xuICAgICAgICBzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93biB8fFxuICAgICAgICAgICgoc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd24gPSAhMCksXG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIFwiJXM6IGBrZXlgIGlzIG5vdCBhIHByb3AuIFRyeWluZyB0byBhY2Nlc3MgaXQgd2lsbCByZXN1bHQgaW4gYHVuZGVmaW5lZGAgYmVpbmcgcmV0dXJuZWQuIElmIHlvdSBuZWVkIHRvIGFjY2VzcyB0aGUgc2FtZSB2YWx1ZSB3aXRoaW4gdGhlIGNoaWxkIGNvbXBvbmVudCwgeW91IHNob3VsZCBwYXNzIGl0IGFzIGEgZGlmZmVyZW50IHByb3AuIChodHRwczovL3JlYWN0LmRldi9saW5rL3NwZWNpYWwtcHJvcHMpXCIsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZVxuICAgICAgICAgICkpO1xuICAgICAgfVxuICAgICAgd2FybkFib3V0QWNjZXNzaW5nS2V5LmlzUmVhY3RXYXJuaW5nID0gITA7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsIFwia2V5XCIsIHtcbiAgICAgICAgZ2V0OiB3YXJuQWJvdXRBY2Nlc3NpbmdLZXksXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITBcbiAgICAgIH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlbGVtZW50UmVmR2V0dGVyV2l0aERlcHJlY2F0aW9uV2FybmluZygpIHtcbiAgICAgIHZhciBjb21wb25lbnROYW1lID0gZ2V0Q29tcG9uZW50TmFtZUZyb21UeXBlKHRoaXMudHlwZSk7XG4gICAgICBkaWRXYXJuQWJvdXRFbGVtZW50UmVmW2NvbXBvbmVudE5hbWVdIHx8XG4gICAgICAgICgoZGlkV2FybkFib3V0RWxlbWVudFJlZltjb21wb25lbnROYW1lXSA9ICEwKSxcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIkFjY2Vzc2luZyBlbGVtZW50LnJlZiB3YXMgcmVtb3ZlZCBpbiBSZWFjdCAxOS4gcmVmIGlzIG5vdyBhIHJlZ3VsYXIgcHJvcC4gSXQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIEpTWCBFbGVtZW50IHR5cGUgaW4gYSBmdXR1cmUgcmVsZWFzZS5cIlxuICAgICAgICApKTtcbiAgICAgIGNvbXBvbmVudE5hbWUgPSB0aGlzLnByb3BzLnJlZjtcbiAgICAgIHJldHVybiB2b2lkIDAgIT09IGNvbXBvbmVudE5hbWUgPyBjb21wb25lbnROYW1lIDogbnVsbDtcbiAgICB9XG4gICAgZnVuY3Rpb24gUmVhY3RFbGVtZW50KHR5cGUsIGtleSwgcHJvcHMsIG93bmVyLCBkZWJ1Z1N0YWNrLCBkZWJ1Z1Rhc2spIHtcbiAgICAgIHZhciByZWZQcm9wID0gcHJvcHMucmVmO1xuICAgICAgdHlwZSA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0VMRU1FTlRfVFlQRSxcbiAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgICAgX293bmVyOiBvd25lclxuICAgICAgfTtcbiAgICAgIG51bGwgIT09ICh2b2lkIDAgIT09IHJlZlByb3AgPyByZWZQcm9wIDogbnVsbClcbiAgICAgICAgPyBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJyZWZcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgICAgICBnZXQ6IGVsZW1lbnRSZWZHZXR0ZXJXaXRoRGVwcmVjYXRpb25XYXJuaW5nXG4gICAgICAgICAgfSlcbiAgICAgICAgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJyZWZcIiwgeyBlbnVtZXJhYmxlOiAhMSwgdmFsdWU6IG51bGwgfSk7XG4gICAgICB0eXBlLl9zdG9yZSA9IHt9O1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUuX3N0b3JlLCBcInZhbGlkYXRlZFwiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITEsXG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICB3cml0YWJsZTogITAsXG4gICAgICAgIHZhbHVlOiAwXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIl9kZWJ1Z0luZm9cIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogbnVsbFxuICAgICAgfSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJfZGVidWdTdGFja1wiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITEsXG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICB3cml0YWJsZTogITAsXG4gICAgICAgIHZhbHVlOiBkZWJ1Z1N0YWNrXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIl9kZWJ1Z1Rhc2tcIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogZGVidWdUYXNrXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5mcmVlemUgJiYgKE9iamVjdC5mcmVlemUodHlwZS5wcm9wcyksIE9iamVjdC5mcmVlemUodHlwZSkpO1xuICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGpzeERFVkltcGwoXG4gICAgICB0eXBlLFxuICAgICAgY29uZmlnLFxuICAgICAgbWF5YmVLZXksXG4gICAgICBpc1N0YXRpY0NoaWxkcmVuLFxuICAgICAgZGVidWdTdGFjayxcbiAgICAgIGRlYnVnVGFza1xuICAgICkge1xuICAgICAgdmFyIGNoaWxkcmVuID0gY29uZmlnLmNoaWxkcmVuO1xuICAgICAgaWYgKHZvaWQgMCAhPT0gY2hpbGRyZW4pXG4gICAgICAgIGlmIChpc1N0YXRpY0NoaWxkcmVuKVxuICAgICAgICAgIGlmIChpc0FycmF5SW1wbChjaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGZvciAoXG4gICAgICAgICAgICAgIGlzU3RhdGljQ2hpbGRyZW4gPSAwO1xuICAgICAgICAgICAgICBpc1N0YXRpY0NoaWxkcmVuIDwgY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICAgICAgICBpc1N0YXRpY0NoaWxkcmVuKytcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgdmFsaWRhdGVDaGlsZEtleXMoY2hpbGRyZW5baXNTdGF0aWNDaGlsZHJlbl0pO1xuICAgICAgICAgICAgT2JqZWN0LmZyZWV6ZSAmJiBPYmplY3QuZnJlZXplKGNoaWxkcmVuKTtcbiAgICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwiUmVhY3QuanN4OiBTdGF0aWMgY2hpbGRyZW4gc2hvdWxkIGFsd2F5cyBiZSBhbiBhcnJheS4gWW91IGFyZSBsaWtlbHkgZXhwbGljaXRseSBjYWxsaW5nIFJlYWN0LmpzeHMgb3IgUmVhY3QuanN4REVWLiBVc2UgdGhlIEJhYmVsIHRyYW5zZm9ybSBpbnN0ZWFkLlwiXG4gICAgICAgICAgICApO1xuICAgICAgICBlbHNlIHZhbGlkYXRlQ2hpbGRLZXlzKGNoaWxkcmVuKTtcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgXCJrZXlcIikpIHtcbiAgICAgICAgY2hpbGRyZW4gPSBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSk7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY29uZmlnKS5maWx0ZXIoZnVuY3Rpb24gKGspIHtcbiAgICAgICAgICByZXR1cm4gXCJrZXlcIiAhPT0gaztcbiAgICAgICAgfSk7XG4gICAgICAgIGlzU3RhdGljQ2hpbGRyZW4gPVxuICAgICAgICAgIDAgPCBrZXlzLmxlbmd0aFxuICAgICAgICAgICAgPyBcIntrZXk6IHNvbWVLZXksIFwiICsga2V5cy5qb2luKFwiOiAuLi4sIFwiKSArIFwiOiAuLi59XCJcbiAgICAgICAgICAgIDogXCJ7a2V5OiBzb21lS2V5fVwiO1xuICAgICAgICBkaWRXYXJuQWJvdXRLZXlTcHJlYWRbY2hpbGRyZW4gKyBpc1N0YXRpY0NoaWxkcmVuXSB8fFxuICAgICAgICAgICgoa2V5cyA9XG4gICAgICAgICAgICAwIDwga2V5cy5sZW5ndGggPyBcIntcIiArIGtleXMuam9pbihcIjogLi4uLCBcIikgKyBcIjogLi4ufVwiIDogXCJ7fVwiKSxcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgJ0EgcHJvcHMgb2JqZWN0IGNvbnRhaW5pbmcgYSBcImtleVwiIHByb3AgaXMgYmVpbmcgc3ByZWFkIGludG8gSlNYOlxcbiAgbGV0IHByb3BzID0gJXM7XFxuICA8JXMgey4uLnByb3BzfSAvPlxcblJlYWN0IGtleXMgbXVzdCBiZSBwYXNzZWQgZGlyZWN0bHkgdG8gSlNYIHdpdGhvdXQgdXNpbmcgc3ByZWFkOlxcbiAgbGV0IHByb3BzID0gJXM7XFxuICA8JXMga2V5PXtzb21lS2V5fSB7Li4ucHJvcHN9IC8+JyxcbiAgICAgICAgICAgIGlzU3RhdGljQ2hpbGRyZW4sXG4gICAgICAgICAgICBjaGlsZHJlbixcbiAgICAgICAgICAgIGtleXMsXG4gICAgICAgICAgICBjaGlsZHJlblxuICAgICAgICAgICksXG4gICAgICAgICAgKGRpZFdhcm5BYm91dEtleVNwcmVhZFtjaGlsZHJlbiArIGlzU3RhdGljQ2hpbGRyZW5dID0gITApKTtcbiAgICAgIH1cbiAgICAgIGNoaWxkcmVuID0gbnVsbDtcbiAgICAgIHZvaWQgMCAhPT0gbWF5YmVLZXkgJiZcbiAgICAgICAgKGNoZWNrS2V5U3RyaW5nQ29lcmNpb24obWF5YmVLZXkpLCAoY2hpbGRyZW4gPSBcIlwiICsgbWF5YmVLZXkpKTtcbiAgICAgIGhhc1ZhbGlkS2V5KGNvbmZpZykgJiZcbiAgICAgICAgKGNoZWNrS2V5U3RyaW5nQ29lcmNpb24oY29uZmlnLmtleSksIChjaGlsZHJlbiA9IFwiXCIgKyBjb25maWcua2V5KSk7XG4gICAgICBpZiAoXCJrZXlcIiBpbiBjb25maWcpIHtcbiAgICAgICAgbWF5YmVLZXkgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgcHJvcE5hbWUgaW4gY29uZmlnKVxuICAgICAgICAgIFwia2V5XCIgIT09IHByb3BOYW1lICYmIChtYXliZUtleVtwcm9wTmFtZV0gPSBjb25maWdbcHJvcE5hbWVdKTtcbiAgICAgIH0gZWxzZSBtYXliZUtleSA9IGNvbmZpZztcbiAgICAgIGNoaWxkcmVuICYmXG4gICAgICAgIGRlZmluZUtleVByb3BXYXJuaW5nR2V0dGVyKFxuICAgICAgICAgIG1heWJlS2V5LFxuICAgICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHR5cGVcbiAgICAgICAgICAgID8gdHlwZS5kaXNwbGF5TmFtZSB8fCB0eXBlLm5hbWUgfHwgXCJVbmtub3duXCJcbiAgICAgICAgICAgIDogdHlwZVxuICAgICAgICApO1xuICAgICAgcmV0dXJuIFJlYWN0RWxlbWVudChcbiAgICAgICAgdHlwZSxcbiAgICAgICAgY2hpbGRyZW4sXG4gICAgICAgIG1heWJlS2V5LFxuICAgICAgICBnZXRPd25lcigpLFxuICAgICAgICBkZWJ1Z1N0YWNrLFxuICAgICAgICBkZWJ1Z1Rhc2tcbiAgICAgICk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlQ2hpbGRLZXlzKG5vZGUpIHtcbiAgICAgIGlzVmFsaWRFbGVtZW50KG5vZGUpXG4gICAgICAgID8gbm9kZS5fc3RvcmUgJiYgKG5vZGUuX3N0b3JlLnZhbGlkYXRlZCA9IDEpXG4gICAgICAgIDogXCJvYmplY3RcIiA9PT0gdHlwZW9mIG5vZGUgJiZcbiAgICAgICAgICBudWxsICE9PSBub2RlICYmXG4gICAgICAgICAgbm9kZS4kJHR5cGVvZiA9PT0gUkVBQ1RfTEFaWV9UWVBFICYmXG4gICAgICAgICAgKFwiZnVsZmlsbGVkXCIgPT09IG5vZGUuX3BheWxvYWQuc3RhdHVzXG4gICAgICAgICAgICA/IGlzVmFsaWRFbGVtZW50KG5vZGUuX3BheWxvYWQudmFsdWUpICYmXG4gICAgICAgICAgICAgIG5vZGUuX3BheWxvYWQudmFsdWUuX3N0b3JlICYmXG4gICAgICAgICAgICAgIChub2RlLl9wYXlsb2FkLnZhbHVlLl9zdG9yZS52YWxpZGF0ZWQgPSAxKVxuICAgICAgICAgICAgOiBub2RlLl9zdG9yZSAmJiAobm9kZS5fc3RvcmUudmFsaWRhdGVkID0gMSkpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1ZhbGlkRWxlbWVudChvYmplY3QpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiBvYmplY3QgJiZcbiAgICAgICAgbnVsbCAhPT0gb2JqZWN0ICYmXG4gICAgICAgIG9iamVjdC4kJHR5cGVvZiA9PT0gUkVBQ1RfRUxFTUVOVF9UWVBFXG4gICAgICApO1xuICAgIH1cbiAgICB2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIiksXG4gICAgICBSRUFDVF9FTEVNRU5UX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QudHJhbnNpdGlvbmFsLmVsZW1lbnRcIiksXG4gICAgICBSRUFDVF9QT1JUQUxfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5wb3J0YWxcIiksXG4gICAgICBSRUFDVF9GUkFHTUVOVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmZyYWdtZW50XCIpLFxuICAgICAgUkVBQ1RfU1RSSUNUX01PREVfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5zdHJpY3RfbW9kZVwiKSxcbiAgICAgIFJFQUNUX1BST0ZJTEVSX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QucHJvZmlsZXJcIiksXG4gICAgICBSRUFDVF9DT05TVU1FUl9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmNvbnN1bWVyXCIpLFxuICAgICAgUkVBQ1RfQ09OVEVYVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmNvbnRleHRcIiksXG4gICAgICBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmZvcndhcmRfcmVmXCIpLFxuICAgICAgUkVBQ1RfU1VTUEVOU0VfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5zdXNwZW5zZVwiKSxcbiAgICAgIFJFQUNUX1NVU1BFTlNFX0xJU1RfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5zdXNwZW5zZV9saXN0XCIpLFxuICAgICAgUkVBQ1RfTUVNT19UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0Lm1lbW9cIiksXG4gICAgICBSRUFDVF9MQVpZX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QubGF6eVwiKSxcbiAgICAgIFJFQUNUX0FDVElWSVRZX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuYWN0aXZpdHlcIiksXG4gICAgICBSRUFDVF9DTElFTlRfUkVGRVJFTkNFID0gU3ltYm9sLmZvcihcInJlYWN0LmNsaWVudC5yZWZlcmVuY2VcIiksXG4gICAgICBSZWFjdFNoYXJlZEludGVybmFscyA9XG4gICAgICAgIFJlYWN0Ll9fQ0xJRU5UX0lOVEVSTkFMU19ET19OT1RfVVNFX09SX1dBUk5fVVNFUlNfVEhFWV9DQU5OT1RfVVBHUkFERSxcbiAgICAgIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSxcbiAgICAgIGlzQXJyYXlJbXBsID0gQXJyYXkuaXNBcnJheSxcbiAgICAgIGNyZWF0ZVRhc2sgPSBjb25zb2xlLmNyZWF0ZVRhc2tcbiAgICAgICAgPyBjb25zb2xlLmNyZWF0ZVRhc2tcbiAgICAgICAgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9O1xuICAgIFJlYWN0ID0ge1xuICAgICAgcmVhY3Rfc3RhY2tfYm90dG9tX2ZyYW1lOiBmdW5jdGlvbiAoY2FsbFN0YWNrRm9yRXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxTdGFja0ZvckVycm9yKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd247XG4gICAgdmFyIGRpZFdhcm5BYm91dEVsZW1lbnRSZWYgPSB7fTtcbiAgICB2YXIgdW5rbm93bk93bmVyRGVidWdTdGFjayA9IFJlYWN0LnJlYWN0X3N0YWNrX2JvdHRvbV9mcmFtZS5iaW5kKFxuICAgICAgUmVhY3QsXG4gICAgICBVbmtub3duT3duZXJcbiAgICApKCk7XG4gICAgdmFyIHVua25vd25Pd25lckRlYnVnVGFzayA9IGNyZWF0ZVRhc2soZ2V0VGFza05hbWUoVW5rbm93bk93bmVyKSk7XG4gICAgdmFyIGRpZFdhcm5BYm91dEtleVNwcmVhZCA9IHt9O1xuICAgIGV4cG9ydHMuRnJhZ21lbnQgPSBSRUFDVF9GUkFHTUVOVF9UWVBFO1xuICAgIGV4cG9ydHMuanN4ID0gZnVuY3Rpb24gKHR5cGUsIGNvbmZpZywgbWF5YmVLZXkpIHtcbiAgICAgIHZhciB0cmFja0FjdHVhbE93bmVyID1cbiAgICAgICAgMWU0ID4gUmVhY3RTaGFyZWRJbnRlcm5hbHMucmVjZW50bHlDcmVhdGVkT3duZXJTdGFja3MrKztcbiAgICAgIHJldHVybiBqc3hERVZJbXBsKFxuICAgICAgICB0eXBlLFxuICAgICAgICBjb25maWcsXG4gICAgICAgIG1heWJlS2V5LFxuICAgICAgICAhMSxcbiAgICAgICAgdHJhY2tBY3R1YWxPd25lclxuICAgICAgICAgID8gRXJyb3IoXCJyZWFjdC1zdGFjay10b3AtZnJhbWVcIilcbiAgICAgICAgICA6IHVua25vd25Pd25lckRlYnVnU3RhY2ssXG4gICAgICAgIHRyYWNrQWN0dWFsT3duZXIgPyBjcmVhdGVUYXNrKGdldFRhc2tOYW1lKHR5cGUpKSA6IHVua25vd25Pd25lckRlYnVnVGFza1xuICAgICAgKTtcbiAgICB9O1xuICAgIGV4cG9ydHMuanN4cyA9IGZ1bmN0aW9uICh0eXBlLCBjb25maWcsIG1heWJlS2V5KSB7XG4gICAgICB2YXIgdHJhY2tBY3R1YWxPd25lciA9XG4gICAgICAgIDFlNCA+IFJlYWN0U2hhcmVkSW50ZXJuYWxzLnJlY2VudGx5Q3JlYXRlZE93bmVyU3RhY2tzKys7XG4gICAgICByZXR1cm4ganN4REVWSW1wbChcbiAgICAgICAgdHlwZSxcbiAgICAgICAgY29uZmlnLFxuICAgICAgICBtYXliZUtleSxcbiAgICAgICAgITAsXG4gICAgICAgIHRyYWNrQWN0dWFsT3duZXJcbiAgICAgICAgICA/IEVycm9yKFwicmVhY3Qtc3RhY2stdG9wLWZyYW1lXCIpXG4gICAgICAgICAgOiB1bmtub3duT3duZXJEZWJ1Z1N0YWNrLFxuICAgICAgICB0cmFja0FjdHVhbE93bmVyID8gY3JlYXRlVGFzayhnZXRUYXNrTmFtZSh0eXBlKSkgOiB1bmtub3duT3duZXJEZWJ1Z1Rhc2tcbiAgICAgICk7XG4gICAgfTtcbiAgfSkoKTtcbiIsCiAgICAiJ3VzZSBzdHJpY3QnO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJykge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LWpzeC1ydW50aW1lLnByb2R1Y3Rpb24uanMnKTtcbn0gZWxzZSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QtanN4LXJ1bnRpbWUuZGV2ZWxvcG1lbnQuanMnKTtcbn1cbiIsCiAgICAiLyoqXG4gKiBAbGljZW5zZSBSZWFjdFxuICogcmVhY3QtanN4LWRldi1ydW50aW1lLmRldmVsb3BtZW50LmpzXG4gKlxuICogQ29weXJpZ2h0IChjKSBNZXRhIFBsYXRmb3JtcywgSW5jLiBhbmQgYWZmaWxpYXRlcy5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqL1xuXG5cInVzZSBzdHJpY3RcIjtcblwicHJvZHVjdGlvblwiICE9PSBwcm9jZXNzLmVudi5OT0RFX0VOViAmJlxuICAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0eXBlKSB7XG4gICAgICBpZiAobnVsbCA9PSB0eXBlKSByZXR1cm4gbnVsbDtcbiAgICAgIGlmIChcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiB0eXBlKVxuICAgICAgICByZXR1cm4gdHlwZS4kJHR5cGVvZiA9PT0gUkVBQ1RfQ0xJRU5UX1JFRkVSRU5DRVxuICAgICAgICAgID8gbnVsbFxuICAgICAgICAgIDogdHlwZS5kaXNwbGF5TmFtZSB8fCB0eXBlLm5hbWUgfHwgbnVsbDtcbiAgICAgIGlmIChcInN0cmluZ1wiID09PSB0eXBlb2YgdHlwZSkgcmV0dXJuIHR5cGU7XG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBSRUFDVF9GUkFHTUVOVF9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIkZyYWdtZW50XCI7XG4gICAgICAgIGNhc2UgUkVBQ1RfUFJPRklMRVJfVFlQRTpcbiAgICAgICAgICByZXR1cm4gXCJQcm9maWxlclwiO1xuICAgICAgICBjYXNlIFJFQUNUX1NUUklDVF9NT0RFX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiU3RyaWN0TW9kZVwiO1xuICAgICAgICBjYXNlIFJFQUNUX1NVU1BFTlNFX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiU3VzcGVuc2VcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVVNQRU5TRV9MSVNUX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiU3VzcGVuc2VMaXN0XCI7XG4gICAgICAgIGNhc2UgUkVBQ1RfQUNUSVZJVFlfVFlQRTpcbiAgICAgICAgICByZXR1cm4gXCJBY3Rpdml0eVwiO1xuICAgICAgfVxuICAgICAgaWYgKFwib2JqZWN0XCIgPT09IHR5cGVvZiB0eXBlKVxuICAgICAgICBzd2l0Y2ggKFxuICAgICAgICAgIChcIm51bWJlclwiID09PSB0eXBlb2YgdHlwZS50YWcgJiZcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwiUmVjZWl2ZWQgYW4gdW5leHBlY3RlZCBvYmplY3QgaW4gZ2V0Q29tcG9uZW50TmFtZUZyb21UeXBlKCkuIFRoaXMgaXMgbGlrZWx5IGEgYnVnIGluIFJlYWN0LiBQbGVhc2UgZmlsZSBhbiBpc3N1ZS5cIlxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB0eXBlLiQkdHlwZW9mKVxuICAgICAgICApIHtcbiAgICAgICAgICBjYXNlIFJFQUNUX1BPUlRBTF9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIFwiUG9ydGFsXCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9DT05URVhUX1RZUEU6XG4gICAgICAgICAgICByZXR1cm4gdHlwZS5kaXNwbGF5TmFtZSB8fCBcIkNvbnRleHRcIjtcbiAgICAgICAgICBjYXNlIFJFQUNUX0NPTlNVTUVSX1RZUEU6XG4gICAgICAgICAgICByZXR1cm4gKHR5cGUuX2NvbnRleHQuZGlzcGxheU5hbWUgfHwgXCJDb250ZXh0XCIpICsgXCIuQ29uc3VtZXJcIjtcbiAgICAgICAgICBjYXNlIFJFQUNUX0ZPUldBUkRfUkVGX1RZUEU6XG4gICAgICAgICAgICB2YXIgaW5uZXJUeXBlID0gdHlwZS5yZW5kZXI7XG4gICAgICAgICAgICB0eXBlID0gdHlwZS5kaXNwbGF5TmFtZTtcbiAgICAgICAgICAgIHR5cGUgfHxcbiAgICAgICAgICAgICAgKCh0eXBlID0gaW5uZXJUeXBlLmRpc3BsYXlOYW1lIHx8IGlubmVyVHlwZS5uYW1lIHx8IFwiXCIpLFxuICAgICAgICAgICAgICAodHlwZSA9IFwiXCIgIT09IHR5cGUgPyBcIkZvcndhcmRSZWYoXCIgKyB0eXBlICsgXCIpXCIgOiBcIkZvcndhcmRSZWZcIikpO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGU7XG4gICAgICAgICAgY2FzZSBSRUFDVF9NRU1PX1RZUEU6XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAoaW5uZXJUeXBlID0gdHlwZS5kaXNwbGF5TmFtZSB8fCBudWxsKSxcbiAgICAgICAgICAgICAgbnVsbCAhPT0gaW5uZXJUeXBlXG4gICAgICAgICAgICAgICAgPyBpbm5lclR5cGVcbiAgICAgICAgICAgICAgICA6IGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0eXBlLnR5cGUpIHx8IFwiTWVtb1wiXG4gICAgICAgICAgICApO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfTEFaWV9UWVBFOlxuICAgICAgICAgICAgaW5uZXJUeXBlID0gdHlwZS5fcGF5bG9hZDtcbiAgICAgICAgICAgIHR5cGUgPSB0eXBlLl9pbml0O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0eXBlKGlubmVyVHlwZSkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoeCkge31cbiAgICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHRlc3RTdHJpbmdDb2VyY2lvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIFwiXCIgKyB2YWx1ZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gY2hlY2tLZXlTdHJpbmdDb2VyY2lvbih2YWx1ZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGVzdFN0cmluZ0NvZXJjaW9uKHZhbHVlKTtcbiAgICAgICAgdmFyIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9ICExO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQgPSAhMDtcbiAgICAgIH1cbiAgICAgIGlmIChKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQpIHtcbiAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gY29uc29sZTtcbiAgICAgICAgdmFyIEpTQ29tcGlsZXJfdGVtcF9jb25zdCA9IEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdC5lcnJvcjtcbiAgICAgICAgdmFyIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCRqc2NvbXAkMCA9XG4gICAgICAgICAgKFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIFN5bWJvbCAmJlxuICAgICAgICAgICAgU3ltYm9sLnRvU3RyaW5nVGFnICYmXG4gICAgICAgICAgICB2YWx1ZVtTeW1ib2wudG9TdHJpbmdUYWddKSB8fFxuICAgICAgICAgIHZhbHVlLmNvbnN0cnVjdG9yLm5hbWUgfHxcbiAgICAgICAgICBcIk9iamVjdFwiO1xuICAgICAgICBKU0NvbXBpbGVyX3RlbXBfY29uc3QuY2FsbChcbiAgICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQsXG4gICAgICAgICAgXCJUaGUgcHJvdmlkZWQga2V5IGlzIGFuIHVuc3VwcG9ydGVkIHR5cGUgJXMuIFRoaXMgdmFsdWUgbXVzdCBiZSBjb2VyY2VkIHRvIGEgc3RyaW5nIGJlZm9yZSB1c2luZyBpdCBoZXJlLlwiLFxuICAgICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCRqc2NvbXAkMFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gdGVzdFN0cmluZ0NvZXJjaW9uKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0VGFza05hbWUodHlwZSkge1xuICAgICAgaWYgKHR5cGUgPT09IFJFQUNUX0ZSQUdNRU5UX1RZUEUpIHJldHVybiBcIjw+XCI7XG4gICAgICBpZiAoXG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiB0eXBlICYmXG4gICAgICAgIG51bGwgIT09IHR5cGUgJiZcbiAgICAgICAgdHlwZS4kJHR5cGVvZiA9PT0gUkVBQ1RfTEFaWV9UWVBFXG4gICAgICApXG4gICAgICAgIHJldHVybiBcIjwuLi4+XCI7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgbmFtZSA9IGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0eXBlKTtcbiAgICAgICAgcmV0dXJuIG5hbWUgPyBcIjxcIiArIG5hbWUgKyBcIj5cIiA6IFwiPC4uLj5cIjtcbiAgICAgIH0gY2F0Y2ggKHgpIHtcbiAgICAgICAgcmV0dXJuIFwiPC4uLj5cIjtcbiAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0T3duZXIoKSB7XG4gICAgICB2YXIgZGlzcGF0Y2hlciA9IFJlYWN0U2hhcmVkSW50ZXJuYWxzLkE7XG4gICAgICByZXR1cm4gbnVsbCA9PT0gZGlzcGF0Y2hlciA/IG51bGwgOiBkaXNwYXRjaGVyLmdldE93bmVyKCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIFVua25vd25Pd25lcigpIHtcbiAgICAgIHJldHVybiBFcnJvcihcInJlYWN0LXN0YWNrLXRvcC1mcmFtZVwiKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaGFzVmFsaWRLZXkoY29uZmlnKSB7XG4gICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChjb25maWcsIFwia2V5XCIpKSB7XG4gICAgICAgIHZhciBnZXR0ZXIgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGNvbmZpZywgXCJrZXlcIikuZ2V0O1xuICAgICAgICBpZiAoZ2V0dGVyICYmIGdldHRlci5pc1JlYWN0V2FybmluZykgcmV0dXJuICExO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZvaWQgMCAhPT0gY29uZmlnLmtleTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZGVmaW5lS2V5UHJvcFdhcm5pbmdHZXR0ZXIocHJvcHMsIGRpc3BsYXlOYW1lKSB7XG4gICAgICBmdW5jdGlvbiB3YXJuQWJvdXRBY2Nlc3NpbmdLZXkoKSB7XG4gICAgICAgIHNwZWNpYWxQcm9wS2V5V2FybmluZ1Nob3duIHx8XG4gICAgICAgICAgKChzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93biA9ICEwKSxcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgXCIlczogYGtleWAgaXMgbm90IGEgcHJvcC4gVHJ5aW5nIHRvIGFjY2VzcyBpdCB3aWxsIHJlc3VsdCBpbiBgdW5kZWZpbmVkYCBiZWluZyByZXR1cm5lZC4gSWYgeW91IG5lZWQgdG8gYWNjZXNzIHRoZSBzYW1lIHZhbHVlIHdpdGhpbiB0aGUgY2hpbGQgY29tcG9uZW50LCB5b3Ugc2hvdWxkIHBhc3MgaXQgYXMgYSBkaWZmZXJlbnQgcHJvcC4gKGh0dHBzOi8vcmVhY3QuZGV2L2xpbmsvc3BlY2lhbC1wcm9wcylcIixcbiAgICAgICAgICAgIGRpc3BsYXlOYW1lXG4gICAgICAgICAgKSk7XG4gICAgICB9XG4gICAgICB3YXJuQWJvdXRBY2Nlc3NpbmdLZXkuaXNSZWFjdFdhcm5pbmcgPSAhMDtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9wcywgXCJrZXlcIiwge1xuICAgICAgICBnZXQ6IHdhcm5BYm91dEFjY2Vzc2luZ0tleSxcbiAgICAgICAgY29uZmlndXJhYmxlOiAhMFxuICAgICAgfSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGVsZW1lbnRSZWZHZXR0ZXJXaXRoRGVwcmVjYXRpb25XYXJuaW5nKCkge1xuICAgICAgdmFyIGNvbXBvbmVudE5hbWUgPSBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodGhpcy50eXBlKTtcbiAgICAgIGRpZFdhcm5BYm91dEVsZW1lbnRSZWZbY29tcG9uZW50TmFtZV0gfHxcbiAgICAgICAgKChkaWRXYXJuQWJvdXRFbGVtZW50UmVmW2NvbXBvbmVudE5hbWVdID0gITApLFxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiQWNjZXNzaW5nIGVsZW1lbnQucmVmIHdhcyByZW1vdmVkIGluIFJlYWN0IDE5LiByZWYgaXMgbm93IGEgcmVndWxhciBwcm9wLiBJdCB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUgSlNYIEVsZW1lbnQgdHlwZSBpbiBhIGZ1dHVyZSByZWxlYXNlLlwiXG4gICAgICAgICkpO1xuICAgICAgY29tcG9uZW50TmFtZSA9IHRoaXMucHJvcHMucmVmO1xuICAgICAgcmV0dXJuIHZvaWQgMCAhPT0gY29tcG9uZW50TmFtZSA/IGNvbXBvbmVudE5hbWUgOiBudWxsO1xuICAgIH1cbiAgICBmdW5jdGlvbiBSZWFjdEVsZW1lbnQodHlwZSwga2V5LCBwcm9wcywgb3duZXIsIGRlYnVnU3RhY2ssIGRlYnVnVGFzaykge1xuICAgICAgdmFyIHJlZlByb3AgPSBwcm9wcy5yZWY7XG4gICAgICB0eXBlID0ge1xuICAgICAgICAkJHR5cGVvZjogUkVBQ1RfRUxFTUVOVF9UWVBFLFxuICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgICBfb3duZXI6IG93bmVyXG4gICAgICB9O1xuICAgICAgbnVsbCAhPT0gKHZvaWQgMCAhPT0gcmVmUHJvcCA/IHJlZlByb3AgOiBudWxsKVxuICAgICAgICA/IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcInJlZlwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgICAgIGdldDogZWxlbWVudFJlZkdldHRlcldpdGhEZXByZWNhdGlvbldhcm5pbmdcbiAgICAgICAgICB9KVxuICAgICAgICA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcInJlZlwiLCB7IGVudW1lcmFibGU6ICExLCB2YWx1ZTogbnVsbCB9KTtcbiAgICAgIHR5cGUuX3N0b3JlID0ge307XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZS5fc3RvcmUsIFwidmFsaWRhdGVkXCIsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiAhMSxcbiAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgIHdyaXRhYmxlOiAhMCxcbiAgICAgICAgdmFsdWU6IDBcbiAgICAgIH0pO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwiX2RlYnVnSW5mb1wiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITEsXG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICB3cml0YWJsZTogITAsXG4gICAgICAgIHZhbHVlOiBudWxsXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIl9kZWJ1Z1N0YWNrXCIsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiAhMSxcbiAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgIHdyaXRhYmxlOiAhMCxcbiAgICAgICAgdmFsdWU6IGRlYnVnU3RhY2tcbiAgICAgIH0pO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwiX2RlYnVnVGFza1wiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITEsXG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICB3cml0YWJsZTogITAsXG4gICAgICAgIHZhbHVlOiBkZWJ1Z1Rhc2tcbiAgICAgIH0pO1xuICAgICAgT2JqZWN0LmZyZWV6ZSAmJiAoT2JqZWN0LmZyZWV6ZSh0eXBlLnByb3BzKSwgT2JqZWN0LmZyZWV6ZSh0eXBlKSk7XG4gICAgICByZXR1cm4gdHlwZTtcbiAgICB9XG4gICAgZnVuY3Rpb24ganN4REVWSW1wbChcbiAgICAgIHR5cGUsXG4gICAgICBjb25maWcsXG4gICAgICBtYXliZUtleSxcbiAgICAgIGlzU3RhdGljQ2hpbGRyZW4sXG4gICAgICBkZWJ1Z1N0YWNrLFxuICAgICAgZGVidWdUYXNrXG4gICAgKSB7XG4gICAgICB2YXIgY2hpbGRyZW4gPSBjb25maWcuY2hpbGRyZW47XG4gICAgICBpZiAodm9pZCAwICE9PSBjaGlsZHJlbilcbiAgICAgICAgaWYgKGlzU3RhdGljQ2hpbGRyZW4pXG4gICAgICAgICAgaWYgKGlzQXJyYXlJbXBsKGNoaWxkcmVuKSkge1xuICAgICAgICAgICAgZm9yIChcbiAgICAgICAgICAgICAgaXNTdGF0aWNDaGlsZHJlbiA9IDA7XG4gICAgICAgICAgICAgIGlzU3RhdGljQ2hpbGRyZW4gPCBjaGlsZHJlbi5sZW5ndGg7XG4gICAgICAgICAgICAgIGlzU3RhdGljQ2hpbGRyZW4rK1xuICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB2YWxpZGF0ZUNoaWxkS2V5cyhjaGlsZHJlbltpc1N0YXRpY0NoaWxkcmVuXSk7XG4gICAgICAgICAgICBPYmplY3QuZnJlZXplICYmIE9iamVjdC5mcmVlemUoY2hpbGRyZW4pO1xuICAgICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgXCJSZWFjdC5qc3g6IFN0YXRpYyBjaGlsZHJlbiBzaG91bGQgYWx3YXlzIGJlIGFuIGFycmF5LiBZb3UgYXJlIGxpa2VseSBleHBsaWNpdGx5IGNhbGxpbmcgUmVhY3QuanN4cyBvciBSZWFjdC5qc3hERVYuIFVzZSB0aGUgQmFiZWwgdHJhbnNmb3JtIGluc3RlYWQuXCJcbiAgICAgICAgICAgICk7XG4gICAgICAgIGVsc2UgdmFsaWRhdGVDaGlsZEtleXMoY2hpbGRyZW4pO1xuICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBcImtleVwiKSkge1xuICAgICAgICBjaGlsZHJlbiA9IGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0eXBlKTtcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjb25maWcpLmZpbHRlcihmdW5jdGlvbiAoaykge1xuICAgICAgICAgIHJldHVybiBcImtleVwiICE9PSBrO1xuICAgICAgICB9KTtcbiAgICAgICAgaXNTdGF0aWNDaGlsZHJlbiA9XG4gICAgICAgICAgMCA8IGtleXMubGVuZ3RoXG4gICAgICAgICAgICA/IFwie2tleTogc29tZUtleSwgXCIgKyBrZXlzLmpvaW4oXCI6IC4uLiwgXCIpICsgXCI6IC4uLn1cIlxuICAgICAgICAgICAgOiBcIntrZXk6IHNvbWVLZXl9XCI7XG4gICAgICAgIGRpZFdhcm5BYm91dEtleVNwcmVhZFtjaGlsZHJlbiArIGlzU3RhdGljQ2hpbGRyZW5dIHx8XG4gICAgICAgICAgKChrZXlzID1cbiAgICAgICAgICAgIDAgPCBrZXlzLmxlbmd0aCA/IFwie1wiICsga2V5cy5qb2luKFwiOiAuLi4sIFwiKSArIFwiOiAuLi59XCIgOiBcInt9XCIpLFxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAnQSBwcm9wcyBvYmplY3QgY29udGFpbmluZyBhIFwia2V5XCIgcHJvcCBpcyBiZWluZyBzcHJlYWQgaW50byBKU1g6XFxuICBsZXQgcHJvcHMgPSAlcztcXG4gIDwlcyB7Li4ucHJvcHN9IC8+XFxuUmVhY3Qga2V5cyBtdXN0IGJlIHBhc3NlZCBkaXJlY3RseSB0byBKU1ggd2l0aG91dCB1c2luZyBzcHJlYWQ6XFxuICBsZXQgcHJvcHMgPSAlcztcXG4gIDwlcyBrZXk9e3NvbWVLZXl9IHsuLi5wcm9wc30gLz4nLFxuICAgICAgICAgICAgaXNTdGF0aWNDaGlsZHJlbixcbiAgICAgICAgICAgIGNoaWxkcmVuLFxuICAgICAgICAgICAga2V5cyxcbiAgICAgICAgICAgIGNoaWxkcmVuXG4gICAgICAgICAgKSxcbiAgICAgICAgICAoZGlkV2FybkFib3V0S2V5U3ByZWFkW2NoaWxkcmVuICsgaXNTdGF0aWNDaGlsZHJlbl0gPSAhMCkpO1xuICAgICAgfVxuICAgICAgY2hpbGRyZW4gPSBudWxsO1xuICAgICAgdm9pZCAwICE9PSBtYXliZUtleSAmJlxuICAgICAgICAoY2hlY2tLZXlTdHJpbmdDb2VyY2lvbihtYXliZUtleSksIChjaGlsZHJlbiA9IFwiXCIgKyBtYXliZUtleSkpO1xuICAgICAgaGFzVmFsaWRLZXkoY29uZmlnKSAmJlxuICAgICAgICAoY2hlY2tLZXlTdHJpbmdDb2VyY2lvbihjb25maWcua2V5KSwgKGNoaWxkcmVuID0gXCJcIiArIGNvbmZpZy5rZXkpKTtcbiAgICAgIGlmIChcImtleVwiIGluIGNvbmZpZykge1xuICAgICAgICBtYXliZUtleSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBjb25maWcpXG4gICAgICAgICAgXCJrZXlcIiAhPT0gcHJvcE5hbWUgJiYgKG1heWJlS2V5W3Byb3BOYW1lXSA9IGNvbmZpZ1twcm9wTmFtZV0pO1xuICAgICAgfSBlbHNlIG1heWJlS2V5ID0gY29uZmlnO1xuICAgICAgY2hpbGRyZW4gJiZcbiAgICAgICAgZGVmaW5lS2V5UHJvcFdhcm5pbmdHZXR0ZXIoXG4gICAgICAgICAgbWF5YmVLZXksXG4gICAgICAgICAgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgdHlwZVxuICAgICAgICAgICAgPyB0eXBlLmRpc3BsYXlOYW1lIHx8IHR5cGUubmFtZSB8fCBcIlVua25vd25cIlxuICAgICAgICAgICAgOiB0eXBlXG4gICAgICAgICk7XG4gICAgICByZXR1cm4gUmVhY3RFbGVtZW50KFxuICAgICAgICB0eXBlLFxuICAgICAgICBjaGlsZHJlbixcbiAgICAgICAgbWF5YmVLZXksXG4gICAgICAgIGdldE93bmVyKCksXG4gICAgICAgIGRlYnVnU3RhY2ssXG4gICAgICAgIGRlYnVnVGFza1xuICAgICAgKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gdmFsaWRhdGVDaGlsZEtleXMobm9kZSkge1xuICAgICAgaXNWYWxpZEVsZW1lbnQobm9kZSlcbiAgICAgICAgPyBub2RlLl9zdG9yZSAmJiAobm9kZS5fc3RvcmUudmFsaWRhdGVkID0gMSlcbiAgICAgICAgOiBcIm9iamVjdFwiID09PSB0eXBlb2Ygbm9kZSAmJlxuICAgICAgICAgIG51bGwgIT09IG5vZGUgJiZcbiAgICAgICAgICBub2RlLiQkdHlwZW9mID09PSBSRUFDVF9MQVpZX1RZUEUgJiZcbiAgICAgICAgICAoXCJmdWxmaWxsZWRcIiA9PT0gbm9kZS5fcGF5bG9hZC5zdGF0dXNcbiAgICAgICAgICAgID8gaXNWYWxpZEVsZW1lbnQobm9kZS5fcGF5bG9hZC52YWx1ZSkgJiZcbiAgICAgICAgICAgICAgbm9kZS5fcGF5bG9hZC52YWx1ZS5fc3RvcmUgJiZcbiAgICAgICAgICAgICAgKG5vZGUuX3BheWxvYWQudmFsdWUuX3N0b3JlLnZhbGlkYXRlZCA9IDEpXG4gICAgICAgICAgICA6IG5vZGUuX3N0b3JlICYmIChub2RlLl9zdG9yZS52YWxpZGF0ZWQgPSAxKSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzVmFsaWRFbGVtZW50KG9iamVjdCkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIG9iamVjdCAmJlxuICAgICAgICBudWxsICE9PSBvYmplY3QgJiZcbiAgICAgICAgb2JqZWN0LiQkdHlwZW9mID09PSBSRUFDVF9FTEVNRU5UX1RZUEVcbiAgICAgICk7XG4gICAgfVxuICAgIHZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKSxcbiAgICAgIFJFQUNUX0VMRU1FTlRfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC50cmFuc2l0aW9uYWwuZWxlbWVudFwiKSxcbiAgICAgIFJFQUNUX1BPUlRBTF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnBvcnRhbFwiKSxcbiAgICAgIFJFQUNUX0ZSQUdNRU5UX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZnJhZ21lbnRcIiksXG4gICAgICBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN0cmljdF9tb2RlXCIpLFxuICAgICAgUkVBQ1RfUFJPRklMRVJfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5wcm9maWxlclwiKSxcbiAgICAgIFJFQUNUX0NPTlNVTUVSX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuY29uc3VtZXJcIiksXG4gICAgICBSRUFDVF9DT05URVhUX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuY29udGV4dFwiKSxcbiAgICAgIFJFQUNUX0ZPUldBUkRfUkVGX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZm9yd2FyZF9yZWZcIiksXG4gICAgICBSRUFDVF9TVVNQRU5TRV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlXCIpLFxuICAgICAgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlX2xpc3RcIiksXG4gICAgICBSRUFDVF9NRU1PX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QubWVtb1wiKSxcbiAgICAgIFJFQUNUX0xBWllfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5sYXp5XCIpLFxuICAgICAgUkVBQ1RfQUNUSVZJVFlfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5hY3Rpdml0eVwiKSxcbiAgICAgIFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0UgPSBTeW1ib2wuZm9yKFwicmVhY3QuY2xpZW50LnJlZmVyZW5jZVwiKSxcbiAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzID1cbiAgICAgICAgUmVhY3QuX19DTElFTlRfSU5URVJOQUxTX0RPX05PVF9VU0VfT1JfV0FSTl9VU0VSU19USEVZX0NBTk5PVF9VUEdSQURFLFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LFxuICAgICAgaXNBcnJheUltcGwgPSBBcnJheS5pc0FycmF5LFxuICAgICAgY3JlYXRlVGFzayA9IGNvbnNvbGUuY3JlYXRlVGFza1xuICAgICAgICA/IGNvbnNvbGUuY3JlYXRlVGFza1xuICAgICAgICA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH07XG4gICAgUmVhY3QgPSB7XG4gICAgICByZWFjdF9zdGFja19ib3R0b21fZnJhbWU6IGZ1bmN0aW9uIChjYWxsU3RhY2tGb3JFcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbFN0YWNrRm9yRXJyb3IoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93bjtcbiAgICB2YXIgZGlkV2FybkFib3V0RWxlbWVudFJlZiA9IHt9O1xuICAgIHZhciB1bmtub3duT3duZXJEZWJ1Z1N0YWNrID0gUmVhY3QucmVhY3Rfc3RhY2tfYm90dG9tX2ZyYW1lLmJpbmQoXG4gICAgICBSZWFjdCxcbiAgICAgIFVua25vd25Pd25lclxuICAgICkoKTtcbiAgICB2YXIgdW5rbm93bk93bmVyRGVidWdUYXNrID0gY3JlYXRlVGFzayhnZXRUYXNrTmFtZShVbmtub3duT3duZXIpKTtcbiAgICB2YXIgZGlkV2FybkFib3V0S2V5U3ByZWFkID0ge307XG4gICAgZXhwb3J0cy5GcmFnbWVudCA9IFJFQUNUX0ZSQUdNRU5UX1RZUEU7XG4gICAgZXhwb3J0cy5qc3hERVYgPSBmdW5jdGlvbiAodHlwZSwgY29uZmlnLCBtYXliZUtleSwgaXNTdGF0aWNDaGlsZHJlbikge1xuICAgICAgdmFyIHRyYWNrQWN0dWFsT3duZXIgPVxuICAgICAgICAxZTQgPiBSZWFjdFNoYXJlZEludGVybmFscy5yZWNlbnRseUNyZWF0ZWRPd25lclN0YWNrcysrO1xuICAgICAgcmV0dXJuIGpzeERFVkltcGwoXG4gICAgICAgIHR5cGUsXG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgbWF5YmVLZXksXG4gICAgICAgIGlzU3RhdGljQ2hpbGRyZW4sXG4gICAgICAgIHRyYWNrQWN0dWFsT3duZXJcbiAgICAgICAgICA/IEVycm9yKFwicmVhY3Qtc3RhY2stdG9wLWZyYW1lXCIpXG4gICAgICAgICAgOiB1bmtub3duT3duZXJEZWJ1Z1N0YWNrLFxuICAgICAgICB0cmFja0FjdHVhbE93bmVyID8gY3JlYXRlVGFzayhnZXRUYXNrTmFtZSh0eXBlKSkgOiB1bmtub3duT3duZXJEZWJ1Z1Rhc2tcbiAgICAgICk7XG4gICAgfTtcbiAgfSkoKTtcbiIsCiAgICAiJ3VzZSBzdHJpY3QnO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJykge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LWpzeC1kZXYtcnVudGltZS5wcm9kdWN0aW9uLmpzJyk7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LWpzeC1kZXYtcnVudGltZS5kZXZlbG9wbWVudC5qcycpO1xufVxuIiwKICAgICIvKipcbiAqIEBsaWNlbnNlIFJlYWN0XG4gKiByZWFjdC1kb20uZGV2ZWxvcG1lbnQuanNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIE1ldGEgUGxhdGZvcm1zLCBJbmMuIGFuZCBhZmZpbGlhdGVzLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLlxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXCJwcm9kdWN0aW9uXCIgIT09IHByb2Nlc3MuZW52Lk5PREVfRU5WICYmXG4gIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gbm9vcCgpIHt9XG4gICAgZnVuY3Rpb24gdGVzdFN0cmluZ0NvZXJjaW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gXCJcIiArIHZhbHVlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjcmVhdGVQb3J0YWwkMShjaGlsZHJlbiwgY29udGFpbmVySW5mbywgaW1wbGVtZW50YXRpb24pIHtcbiAgICAgIHZhciBrZXkgPVxuICAgICAgICAzIDwgYXJndW1lbnRzLmxlbmd0aCAmJiB2b2lkIDAgIT09IGFyZ3VtZW50c1szXSA/IGFyZ3VtZW50c1szXSA6IG51bGw7XG4gICAgICB0cnkge1xuICAgICAgICB0ZXN0U3RyaW5nQ29lcmNpb24oa2V5KTtcbiAgICAgICAgdmFyIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9ICExO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQgPSAhMDtcbiAgICAgIH1cbiAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCAmJlxuICAgICAgICAoY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIlRoZSBwcm92aWRlZCBrZXkgaXMgYW4gdW5zdXBwb3J0ZWQgdHlwZSAlcy4gVGhpcyB2YWx1ZSBtdXN0IGJlIGNvZXJjZWQgdG8gYSBzdHJpbmcgYmVmb3JlIHVzaW5nIGl0IGhlcmUuXCIsXG4gICAgICAgICAgKFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIFN5bWJvbCAmJlxuICAgICAgICAgICAgU3ltYm9sLnRvU3RyaW5nVGFnICYmXG4gICAgICAgICAgICBrZXlbU3ltYm9sLnRvU3RyaW5nVGFnXSkgfHxcbiAgICAgICAgICAgIGtleS5jb25zdHJ1Y3Rvci5uYW1lIHx8XG4gICAgICAgICAgICBcIk9iamVjdFwiXG4gICAgICAgICksXG4gICAgICAgIHRlc3RTdHJpbmdDb2VyY2lvbihrZXkpKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgICQkdHlwZW9mOiBSRUFDVF9QT1JUQUxfVFlQRSxcbiAgICAgICAga2V5OiBudWxsID09IGtleSA/IG51bGwgOiBcIlwiICsga2V5LFxuICAgICAgICBjaGlsZHJlbjogY2hpbGRyZW4sXG4gICAgICAgIGNvbnRhaW5lckluZm86IGNvbnRhaW5lckluZm8sXG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBpbXBsZW1lbnRhdGlvblxuICAgICAgfTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0Q3Jvc3NPcmlnaW5TdHJpbmdBcyhhcywgaW5wdXQpIHtcbiAgICAgIGlmIChcImZvbnRcIiA9PT0gYXMpIHJldHVybiBcIlwiO1xuICAgICAgaWYgKFwic3RyaW5nXCIgPT09IHR5cGVvZiBpbnB1dClcbiAgICAgICAgcmV0dXJuIFwidXNlLWNyZWRlbnRpYWxzXCIgPT09IGlucHV0ID8gaW5wdXQgOiBcIlwiO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdPYmplY3RGb3JXYXJuaW5nKHRoaW5nKSB7XG4gICAgICByZXR1cm4gbnVsbCA9PT0gdGhpbmdcbiAgICAgICAgPyBcImBudWxsYFwiXG4gICAgICAgIDogdm9pZCAwID09PSB0aGluZ1xuICAgICAgICAgID8gXCJgdW5kZWZpbmVkYFwiXG4gICAgICAgICAgOiBcIlwiID09PSB0aGluZ1xuICAgICAgICAgICAgPyBcImFuIGVtcHR5IHN0cmluZ1wiXG4gICAgICAgICAgICA6ICdzb21ldGhpbmcgd2l0aCB0eXBlIFwiJyArIHR5cGVvZiB0aGluZyArICdcIic7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldFZhbHVlRGVzY3JpcHRvckV4cGVjdGluZ0VudW1Gb3JXYXJuaW5nKHRoaW5nKSB7XG4gICAgICByZXR1cm4gbnVsbCA9PT0gdGhpbmdcbiAgICAgICAgPyBcImBudWxsYFwiXG4gICAgICAgIDogdm9pZCAwID09PSB0aGluZ1xuICAgICAgICAgID8gXCJgdW5kZWZpbmVkYFwiXG4gICAgICAgICAgOiBcIlwiID09PSB0aGluZ1xuICAgICAgICAgICAgPyBcImFuIGVtcHR5IHN0cmluZ1wiXG4gICAgICAgICAgICA6IFwic3RyaW5nXCIgPT09IHR5cGVvZiB0aGluZ1xuICAgICAgICAgICAgICA/IEpTT04uc3RyaW5naWZ5KHRoaW5nKVxuICAgICAgICAgICAgICA6IFwibnVtYmVyXCIgPT09IHR5cGVvZiB0aGluZ1xuICAgICAgICAgICAgICAgID8gXCJgXCIgKyB0aGluZyArIFwiYFwiXG4gICAgICAgICAgICAgICAgOiAnc29tZXRoaW5nIHdpdGggdHlwZSBcIicgKyB0eXBlb2YgdGhpbmcgKyAnXCInO1xuICAgIH1cbiAgICBmdW5jdGlvbiByZXNvbHZlRGlzcGF0Y2hlcigpIHtcbiAgICAgIHZhciBkaXNwYXRjaGVyID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuSDtcbiAgICAgIG51bGwgPT09IGRpc3BhdGNoZXIgJiZcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIkludmFsaWQgaG9vayBjYWxsLiBIb29rcyBjYW4gb25seSBiZSBjYWxsZWQgaW5zaWRlIG9mIHRoZSBib2R5IG9mIGEgZnVuY3Rpb24gY29tcG9uZW50LiBUaGlzIGNvdWxkIGhhcHBlbiBmb3Igb25lIG9mIHRoZSBmb2xsb3dpbmcgcmVhc29uczpcXG4xLiBZb3UgbWlnaHQgaGF2ZSBtaXNtYXRjaGluZyB2ZXJzaW9ucyBvZiBSZWFjdCBhbmQgdGhlIHJlbmRlcmVyIChzdWNoIGFzIFJlYWN0IERPTSlcXG4yLiBZb3UgbWlnaHQgYmUgYnJlYWtpbmcgdGhlIFJ1bGVzIG9mIEhvb2tzXFxuMy4gWW91IG1pZ2h0IGhhdmUgbW9yZSB0aGFuIG9uZSBjb3B5IG9mIFJlYWN0IGluIHRoZSBzYW1lIGFwcFxcblNlZSBodHRwczovL3JlYWN0LmRldi9saW5rL2ludmFsaWQtaG9vay1jYWxsIGZvciB0aXBzIGFib3V0IGhvdyB0byBkZWJ1ZyBhbmQgZml4IHRoaXMgcHJvYmxlbS5cIlxuICAgICAgICApO1xuICAgICAgcmV0dXJuIGRpc3BhdGNoZXI7XG4gICAgfVxuICAgIFwidW5kZWZpbmVkXCIgIT09IHR5cGVvZiBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18gJiZcbiAgICAgIFwiZnVuY3Rpb25cIiA9PT1cbiAgICAgICAgdHlwZW9mIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RhcnQgJiZcbiAgICAgIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RhcnQoRXJyb3IoKSk7XG4gICAgdmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpLFxuICAgICAgSW50ZXJuYWxzID0ge1xuICAgICAgICBkOiB7XG4gICAgICAgICAgZjogbm9vcCxcbiAgICAgICAgICByOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgXCJJbnZhbGlkIGZvcm0gZWxlbWVudC4gcmVxdWVzdEZvcm1SZXNldCBtdXN0IGJlIHBhc3NlZCBhIGZvcm0gdGhhdCB3YXMgcmVuZGVyZWQgYnkgUmVhY3QuXCJcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBEOiBub29wLFxuICAgICAgICAgIEM6IG5vb3AsXG4gICAgICAgICAgTDogbm9vcCxcbiAgICAgICAgICBtOiBub29wLFxuICAgICAgICAgIFg6IG5vb3AsXG4gICAgICAgICAgUzogbm9vcCxcbiAgICAgICAgICBNOiBub29wXG4gICAgICAgIH0sXG4gICAgICAgIHA6IDAsXG4gICAgICAgIGZpbmRET01Ob2RlOiBudWxsXG4gICAgICB9LFxuICAgICAgUkVBQ1RfUE9SVEFMX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QucG9ydGFsXCIpLFxuICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMgPVxuICAgICAgICBSZWFjdC5fX0NMSUVOVF9JTlRFUk5BTFNfRE9fTk9UX1VTRV9PUl9XQVJOX1VTRVJTX1RIRVlfQ0FOTk9UX1VQR1JBREU7XG4gICAgKFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIE1hcCAmJlxuICAgICAgbnVsbCAhPSBNYXAucHJvdG90eXBlICYmXG4gICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBNYXAucHJvdG90eXBlLmZvckVhY2ggJiZcbiAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIFNldCAmJlxuICAgICAgbnVsbCAhPSBTZXQucHJvdG90eXBlICYmXG4gICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBTZXQucHJvdG90eXBlLmNsZWFyICYmXG4gICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBTZXQucHJvdG90eXBlLmZvckVhY2gpIHx8XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBcIlJlYWN0IGRlcGVuZHMgb24gTWFwIGFuZCBTZXQgYnVpbHQtaW4gdHlwZXMuIE1ha2Ugc3VyZSB0aGF0IHlvdSBsb2FkIGEgcG9seWZpbGwgaW4gb2xkZXIgYnJvd3NlcnMuIGh0dHBzOi8vcmVhY3Rqcy5vcmcvbGluay9yZWFjdC1wb2x5ZmlsbHNcIlxuICAgICAgKTtcbiAgICBleHBvcnRzLl9fRE9NX0lOVEVSTkFMU19ET19OT1RfVVNFX09SX1dBUk5fVVNFUlNfVEhFWV9DQU5OT1RfVVBHUkFERSA9XG4gICAgICBJbnRlcm5hbHM7XG4gICAgZXhwb3J0cy5jcmVhdGVQb3J0YWwgPSBmdW5jdGlvbiAoY2hpbGRyZW4sIGNvbnRhaW5lcikge1xuICAgICAgdmFyIGtleSA9XG4gICAgICAgIDIgPCBhcmd1bWVudHMubGVuZ3RoICYmIHZvaWQgMCAhPT0gYXJndW1lbnRzWzJdID8gYXJndW1lbnRzWzJdIDogbnVsbDtcbiAgICAgIGlmIChcbiAgICAgICAgIWNvbnRhaW5lciB8fFxuICAgICAgICAoMSAhPT0gY29udGFpbmVyLm5vZGVUeXBlICYmXG4gICAgICAgICAgOSAhPT0gY29udGFpbmVyLm5vZGVUeXBlICYmXG4gICAgICAgICAgMTEgIT09IGNvbnRhaW5lci5ub2RlVHlwZSlcbiAgICAgIClcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJUYXJnZXQgY29udGFpbmVyIGlzIG5vdCBhIERPTSBlbGVtZW50LlwiKTtcbiAgICAgIHJldHVybiBjcmVhdGVQb3J0YWwkMShjaGlsZHJlbiwgY29udGFpbmVyLCBudWxsLCBrZXkpO1xuICAgIH07XG4gICAgZXhwb3J0cy5mbHVzaFN5bmMgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIHZhciBwcmV2aW91c1RyYW5zaXRpb24gPSBSZWFjdFNoYXJlZEludGVybmFscy5ULFxuICAgICAgICBwcmV2aW91c1VwZGF0ZVByaW9yaXR5ID0gSW50ZXJuYWxzLnA7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoKChSZWFjdFNoYXJlZEludGVybmFscy5UID0gbnVsbCksIChJbnRlcm5hbHMucCA9IDIpLCBmbikpXG4gICAgICAgICAgcmV0dXJuIGZuKCk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICAoUmVhY3RTaGFyZWRJbnRlcm5hbHMuVCA9IHByZXZpb3VzVHJhbnNpdGlvbiksXG4gICAgICAgICAgKEludGVybmFscy5wID0gcHJldmlvdXNVcGRhdGVQcmlvcml0eSksXG4gICAgICAgICAgSW50ZXJuYWxzLmQuZigpICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcImZsdXNoU3luYyB3YXMgY2FsbGVkIGZyb20gaW5zaWRlIGEgbGlmZWN5Y2xlIG1ldGhvZC4gUmVhY3QgY2Fubm90IGZsdXNoIHdoZW4gUmVhY3QgaXMgYWxyZWFkeSByZW5kZXJpbmcuIENvbnNpZGVyIG1vdmluZyB0aGlzIGNhbGwgdG8gYSBzY2hlZHVsZXIgdGFzayBvciBtaWNybyB0YXNrLlwiXG4gICAgICAgICAgICApO1xuICAgICAgfVxuICAgIH07XG4gICAgZXhwb3J0cy5wcmVjb25uZWN0ID0gZnVuY3Rpb24gKGhyZWYsIG9wdGlvbnMpIHtcbiAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBocmVmICYmIGhyZWZcbiAgICAgICAgPyBudWxsICE9IG9wdGlvbnMgJiYgXCJvYmplY3RcIiAhPT0gdHlwZW9mIG9wdGlvbnNcbiAgICAgICAgICA/IGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwiUmVhY3RET00ucHJlY29ubmVjdCgpOiBFeHBlY3RlZCB0aGUgYG9wdGlvbnNgIGFyZ3VtZW50IChzZWNvbmQpIHRvIGJlIGFuIG9iamVjdCBidXQgZW5jb3VudGVyZWQgJXMgaW5zdGVhZC4gVGhlIG9ubHkgc3VwcG9ydGVkIG9wdGlvbiBhdCB0aGlzIHRpbWUgaXMgYGNyb3NzT3JpZ2luYCB3aGljaCBhY2NlcHRzIGEgc3RyaW5nLlwiLFxuICAgICAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdFbnVtRm9yV2FybmluZyhvcHRpb25zKVxuICAgICAgICAgICAgKVxuICAgICAgICAgIDogbnVsbCAhPSBvcHRpb25zICYmXG4gICAgICAgICAgICBcInN0cmluZ1wiICE9PSB0eXBlb2Ygb3B0aW9ucy5jcm9zc09yaWdpbiAmJlxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgXCJSZWFjdERPTS5wcmVjb25uZWN0KCk6IEV4cGVjdGVkIHRoZSBgY3Jvc3NPcmlnaW5gIG9wdGlvbiAoc2Vjb25kIGFyZ3VtZW50KSB0byBiZSBhIHN0cmluZyBidXQgZW5jb3VudGVyZWQgJXMgaW5zdGVhZC4gVHJ5IHJlbW92aW5nIHRoaXMgb3B0aW9uIG9yIHBhc3NpbmcgYSBzdHJpbmcgdmFsdWUgaW5zdGVhZC5cIixcbiAgICAgICAgICAgICAgZ2V0VmFsdWVEZXNjcmlwdG9yRXhwZWN0aW5nT2JqZWN0Rm9yV2FybmluZyhvcHRpb25zLmNyb3NzT3JpZ2luKVxuICAgICAgICAgICAgKVxuICAgICAgICA6IGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBcIlJlYWN0RE9NLnByZWNvbm5lY3QoKTogRXhwZWN0ZWQgdGhlIGBocmVmYCBhcmd1bWVudCAoZmlyc3QpIHRvIGJlIGEgbm9uLWVtcHR5IHN0cmluZyBidXQgZW5jb3VudGVyZWQgJXMgaW5zdGVhZC5cIixcbiAgICAgICAgICAgIGdldFZhbHVlRGVzY3JpcHRvckV4cGVjdGluZ09iamVjdEZvcldhcm5pbmcoaHJlZilcbiAgICAgICAgICApO1xuICAgICAgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIGhyZWYgJiZcbiAgICAgICAgKG9wdGlvbnNcbiAgICAgICAgICA/ICgob3B0aW9ucyA9IG9wdGlvbnMuY3Jvc3NPcmlnaW4pLFxuICAgICAgICAgICAgKG9wdGlvbnMgPVxuICAgICAgICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2Ygb3B0aW9uc1xuICAgICAgICAgICAgICAgID8gXCJ1c2UtY3JlZGVudGlhbHNcIiA9PT0gb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgPyBvcHRpb25zXG4gICAgICAgICAgICAgICAgICA6IFwiXCJcbiAgICAgICAgICAgICAgICA6IHZvaWQgMCkpXG4gICAgICAgICAgOiAob3B0aW9ucyA9IG51bGwpLFxuICAgICAgICBJbnRlcm5hbHMuZC5DKGhyZWYsIG9wdGlvbnMpKTtcbiAgICB9O1xuICAgIGV4cG9ydHMucHJlZmV0Y2hETlMgPSBmdW5jdGlvbiAoaHJlZikge1xuICAgICAgaWYgKFwic3RyaW5nXCIgIT09IHR5cGVvZiBocmVmIHx8ICFocmVmKVxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiUmVhY3RET00ucHJlZmV0Y2hETlMoKTogRXhwZWN0ZWQgdGhlIGBocmVmYCBhcmd1bWVudCAoZmlyc3QpIHRvIGJlIGEgbm9uLWVtcHR5IHN0cmluZyBidXQgZW5jb3VudGVyZWQgJXMgaW5zdGVhZC5cIixcbiAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdPYmplY3RGb3JXYXJuaW5nKGhyZWYpXG4gICAgICAgICk7XG4gICAgICBlbHNlIGlmICgxIDwgYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIG9wdGlvbnMgJiYgb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShcImNyb3NzT3JpZ2luXCIpXG4gICAgICAgICAgPyBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcIlJlYWN0RE9NLnByZWZldGNoRE5TKCk6IEV4cGVjdGVkIG9ubHkgb25lIGFyZ3VtZW50LCBgaHJlZmAsIGJ1dCBlbmNvdW50ZXJlZCAlcyBhcyBhIHNlY29uZCBhcmd1bWVudCBpbnN0ZWFkLiBUaGlzIGFyZ3VtZW50IGlzIHJlc2VydmVkIGZvciBmdXR1cmUgb3B0aW9ucyBhbmQgaXMgY3VycmVudGx5IGRpc2FsbG93ZWQuIEl0IGxvb2tzIGxpa2UgdGhlIHlvdSBhcmUgYXR0ZW1wdGluZyB0byBzZXQgYSBjcm9zc09yaWdpbiBwcm9wZXJ0eSBmb3IgdGhpcyBETlMgbG9va3VwIGhpbnQuIEJyb3dzZXJzIGRvIG5vdCBwZXJmb3JtIEROUyBxdWVyaWVzIHVzaW5nIENPUlMgYW5kIHNldHRpbmcgdGhpcyBhdHRyaWJ1dGUgb24gdGhlIHJlc291cmNlIGhpbnQgaGFzIG5vIGVmZmVjdC4gVHJ5IGNhbGxpbmcgUmVhY3RET00ucHJlZmV0Y2hETlMoKSB3aXRoIGp1c3QgYSBzaW5nbGUgc3RyaW5nIGFyZ3VtZW50LCBgaHJlZmAuXCIsXG4gICAgICAgICAgICAgIGdldFZhbHVlRGVzY3JpcHRvckV4cGVjdGluZ0VudW1Gb3JXYXJuaW5nKG9wdGlvbnMpXG4gICAgICAgICAgICApXG4gICAgICAgICAgOiBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcIlJlYWN0RE9NLnByZWZldGNoRE5TKCk6IEV4cGVjdGVkIG9ubHkgb25lIGFyZ3VtZW50LCBgaHJlZmAsIGJ1dCBlbmNvdW50ZXJlZCAlcyBhcyBhIHNlY29uZCBhcmd1bWVudCBpbnN0ZWFkLiBUaGlzIGFyZ3VtZW50IGlzIHJlc2VydmVkIGZvciBmdXR1cmUgb3B0aW9ucyBhbmQgaXMgY3VycmVudGx5IGRpc2FsbG93ZWQuIFRyeSBjYWxsaW5nIFJlYWN0RE9NLnByZWZldGNoRE5TKCkgd2l0aCBqdXN0IGEgc2luZ2xlIHN0cmluZyBhcmd1bWVudCwgYGhyZWZgLlwiLFxuICAgICAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdFbnVtRm9yV2FybmluZyhvcHRpb25zKVxuICAgICAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBocmVmICYmIEludGVybmFscy5kLkQoaHJlZik7XG4gICAgfTtcbiAgICBleHBvcnRzLnByZWluaXQgPSBmdW5jdGlvbiAoaHJlZiwgb3B0aW9ucykge1xuICAgICAgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIGhyZWYgJiYgaHJlZlxuICAgICAgICA/IG51bGwgPT0gb3B0aW9ucyB8fCBcIm9iamVjdFwiICE9PSB0eXBlb2Ygb3B0aW9uc1xuICAgICAgICAgID8gY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgXCJSZWFjdERPTS5wcmVpbml0KCk6IEV4cGVjdGVkIHRoZSBgb3B0aW9uc2AgYXJndW1lbnQgKHNlY29uZCkgdG8gYmUgYW4gb2JqZWN0IHdpdGggYW4gYGFzYCBwcm9wZXJ0eSBkZXNjcmliaW5nIHRoZSB0eXBlIG9mIHJlc291cmNlIHRvIGJlIHByZWluaXRpYWxpemVkIGJ1dCBlbmNvdW50ZXJlZCAlcyBpbnN0ZWFkLlwiLFxuICAgICAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdFbnVtRm9yV2FybmluZyhvcHRpb25zKVxuICAgICAgICAgICAgKVxuICAgICAgICAgIDogXCJzdHlsZVwiICE9PSBvcHRpb25zLmFzICYmXG4gICAgICAgICAgICBcInNjcmlwdFwiICE9PSBvcHRpb25zLmFzICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICAnUmVhY3RET00ucHJlaW5pdCgpOiBFeHBlY3RlZCB0aGUgYGFzYCBwcm9wZXJ0eSBpbiB0aGUgYG9wdGlvbnNgIGFyZ3VtZW50IChzZWNvbmQpIHRvIGNvbnRhaW4gYSB2YWxpZCB2YWx1ZSBkZXNjcmliaW5nIHRoZSB0eXBlIG9mIHJlc291cmNlIHRvIGJlIHByZWluaXRpYWxpemVkIGJ1dCBlbmNvdW50ZXJlZCAlcyBpbnN0ZWFkLiBWYWxpZCB2YWx1ZXMgZm9yIGBhc2AgYXJlIFwic3R5bGVcIiBhbmQgXCJzY3JpcHRcIi4nLFxuICAgICAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdFbnVtRm9yV2FybmluZyhvcHRpb25zLmFzKVxuICAgICAgICAgICAgKVxuICAgICAgICA6IGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBcIlJlYWN0RE9NLnByZWluaXQoKTogRXhwZWN0ZWQgdGhlIGBocmVmYCBhcmd1bWVudCAoZmlyc3QpIHRvIGJlIGEgbm9uLWVtcHR5IHN0cmluZyBidXQgZW5jb3VudGVyZWQgJXMgaW5zdGVhZC5cIixcbiAgICAgICAgICAgIGdldFZhbHVlRGVzY3JpcHRvckV4cGVjdGluZ09iamVjdEZvcldhcm5pbmcoaHJlZilcbiAgICAgICAgICApO1xuICAgICAgaWYgKFxuICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2YgaHJlZiAmJlxuICAgICAgICBvcHRpb25zICYmXG4gICAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLmFzXG4gICAgICApIHtcbiAgICAgICAgdmFyIGFzID0gb3B0aW9ucy5hcyxcbiAgICAgICAgICBjcm9zc09yaWdpbiA9IGdldENyb3NzT3JpZ2luU3RyaW5nQXMoYXMsIG9wdGlvbnMuY3Jvc3NPcmlnaW4pLFxuICAgICAgICAgIGludGVncml0eSA9XG4gICAgICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2Ygb3B0aW9ucy5pbnRlZ3JpdHkgPyBvcHRpb25zLmludGVncml0eSA6IHZvaWQgMCxcbiAgICAgICAgICBmZXRjaFByaW9yaXR5ID1cbiAgICAgICAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLmZldGNoUHJpb3JpdHlcbiAgICAgICAgICAgICAgPyBvcHRpb25zLmZldGNoUHJpb3JpdHlcbiAgICAgICAgICAgICAgOiB2b2lkIDA7XG4gICAgICAgIFwic3R5bGVcIiA9PT0gYXNcbiAgICAgICAgICA/IEludGVybmFscy5kLlMoXG4gICAgICAgICAgICAgIGhyZWYsXG4gICAgICAgICAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLnByZWNlZGVuY2VcbiAgICAgICAgICAgICAgICA/IG9wdGlvbnMucHJlY2VkZW5jZVxuICAgICAgICAgICAgICAgIDogdm9pZCAwLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY3Jvc3NPcmlnaW46IGNyb3NzT3JpZ2luLFxuICAgICAgICAgICAgICAgIGludGVncml0eTogaW50ZWdyaXR5LFxuICAgICAgICAgICAgICAgIGZldGNoUHJpb3JpdHk6IGZldGNoUHJpb3JpdHlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKVxuICAgICAgICAgIDogXCJzY3JpcHRcIiA9PT0gYXMgJiZcbiAgICAgICAgICAgIEludGVybmFscy5kLlgoaHJlZiwge1xuICAgICAgICAgICAgICBjcm9zc09yaWdpbjogY3Jvc3NPcmlnaW4sXG4gICAgICAgICAgICAgIGludGVncml0eTogaW50ZWdyaXR5LFxuICAgICAgICAgICAgICBmZXRjaFByaW9yaXR5OiBmZXRjaFByaW9yaXR5LFxuICAgICAgICAgICAgICBub25jZTogXCJzdHJpbmdcIiA9PT0gdHlwZW9mIG9wdGlvbnMubm9uY2UgPyBvcHRpb25zLm5vbmNlIDogdm9pZCAwXG4gICAgICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGV4cG9ydHMucHJlaW5pdE1vZHVsZSA9IGZ1bmN0aW9uIChocmVmLCBvcHRpb25zKSB7XG4gICAgICB2YXIgZW5jb3VudGVyZWQgPSBcIlwiO1xuICAgICAgKFwic3RyaW5nXCIgPT09IHR5cGVvZiBocmVmICYmIGhyZWYpIHx8XG4gICAgICAgIChlbmNvdW50ZXJlZCArPVxuICAgICAgICAgIFwiIFRoZSBgaHJlZmAgYXJndW1lbnQgZW5jb3VudGVyZWQgd2FzIFwiICtcbiAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdPYmplY3RGb3JXYXJuaW5nKGhyZWYpICtcbiAgICAgICAgICBcIi5cIik7XG4gICAgICB2b2lkIDAgIT09IG9wdGlvbnMgJiYgXCJvYmplY3RcIiAhPT0gdHlwZW9mIG9wdGlvbnNcbiAgICAgICAgPyAoZW5jb3VudGVyZWQgKz1cbiAgICAgICAgICAgIFwiIFRoZSBgb3B0aW9uc2AgYXJndW1lbnQgZW5jb3VudGVyZWQgd2FzIFwiICtcbiAgICAgICAgICAgIGdldFZhbHVlRGVzY3JpcHRvckV4cGVjdGluZ09iamVjdEZvcldhcm5pbmcob3B0aW9ucykgK1xuICAgICAgICAgICAgXCIuXCIpXG4gICAgICAgIDogb3B0aW9ucyAmJlxuICAgICAgICAgIFwiYXNcIiBpbiBvcHRpb25zICYmXG4gICAgICAgICAgXCJzY3JpcHRcIiAhPT0gb3B0aW9ucy5hcyAmJlxuICAgICAgICAgIChlbmNvdW50ZXJlZCArPVxuICAgICAgICAgICAgXCIgVGhlIGBhc2Agb3B0aW9uIGVuY291bnRlcmVkIHdhcyBcIiArXG4gICAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdFbnVtRm9yV2FybmluZyhvcHRpb25zLmFzKSArXG4gICAgICAgICAgICBcIi5cIik7XG4gICAgICBpZiAoZW5jb3VudGVyZWQpXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJSZWFjdERPTS5wcmVpbml0TW9kdWxlKCk6IEV4cGVjdGVkIHVwIHRvIHR3byBhcmd1bWVudHMsIGEgbm9uLWVtcHR5IGBocmVmYCBzdHJpbmcgYW5kLCBvcHRpb25hbGx5LCBhbiBgb3B0aW9uc2Agb2JqZWN0IHdpdGggYSB2YWxpZCBgYXNgIHByb3BlcnR5LiVzXCIsXG4gICAgICAgICAgZW5jb3VudGVyZWRcbiAgICAgICAgKTtcbiAgICAgIGVsc2VcbiAgICAgICAgc3dpdGNoIChcbiAgICAgICAgICAoKGVuY291bnRlcmVkID1cbiAgICAgICAgICAgIG9wdGlvbnMgJiYgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIG9wdGlvbnMuYXMgPyBvcHRpb25zLmFzIDogXCJzY3JpcHRcIiksXG4gICAgICAgICAgZW5jb3VudGVyZWQpXG4gICAgICAgICkge1xuICAgICAgICAgIGNhc2UgXCJzY3JpcHRcIjpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAoZW5jb3VudGVyZWQgPVxuICAgICAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdFbnVtRm9yV2FybmluZyhlbmNvdW50ZXJlZCkpLFxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICAgICdSZWFjdERPTS5wcmVpbml0TW9kdWxlKCk6IEN1cnJlbnRseSB0aGUgb25seSBzdXBwb3J0ZWQgXCJhc1wiIHR5cGUgZm9yIHRoaXMgZnVuY3Rpb24gaXMgXCJzY3JpcHRcIiBidXQgcmVjZWl2ZWQgXCIlc1wiIGluc3RlYWQuIFRoaXMgd2FybmluZyB3YXMgZ2VuZXJhdGVkIGZvciBgaHJlZmAgXCIlc1wiLiBJbiB0aGUgZnV0dXJlIG90aGVyIG1vZHVsZSB0eXBlcyB3aWxsIGJlIHN1cHBvcnRlZCwgYWxpZ25pbmcgd2l0aCB0aGUgaW1wb3J0LWF0dHJpYnV0ZXMgcHJvcG9zYWwuIExlYXJuIG1vcmUgaGVyZTogKGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L3Byb3Bvc2FsLWltcG9ydC1hdHRyaWJ1dGVzKScsXG4gICAgICAgICAgICAgICAgZW5jb3VudGVyZWQsXG4gICAgICAgICAgICAgICAgaHJlZlxuICAgICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICBpZiAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIGhyZWYpXG4gICAgICAgIGlmIChcIm9iamVjdFwiID09PSB0eXBlb2Ygb3B0aW9ucyAmJiBudWxsICE9PSBvcHRpb25zKSB7XG4gICAgICAgICAgaWYgKG51bGwgPT0gb3B0aW9ucy5hcyB8fCBcInNjcmlwdFwiID09PSBvcHRpb25zLmFzKVxuICAgICAgICAgICAgKGVuY291bnRlcmVkID0gZ2V0Q3Jvc3NPcmlnaW5TdHJpbmdBcyhcbiAgICAgICAgICAgICAgb3B0aW9ucy5hcyxcbiAgICAgICAgICAgICAgb3B0aW9ucy5jcm9zc09yaWdpblxuICAgICAgICAgICAgKSksXG4gICAgICAgICAgICAgIEludGVybmFscy5kLk0oaHJlZiwge1xuICAgICAgICAgICAgICAgIGNyb3NzT3JpZ2luOiBlbmNvdW50ZXJlZCxcbiAgICAgICAgICAgICAgICBpbnRlZ3JpdHk6XG4gICAgICAgICAgICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2Ygb3B0aW9ucy5pbnRlZ3JpdHlcbiAgICAgICAgICAgICAgICAgICAgPyBvcHRpb25zLmludGVncml0eVxuICAgICAgICAgICAgICAgICAgICA6IHZvaWQgMCxcbiAgICAgICAgICAgICAgICBub25jZTpcbiAgICAgICAgICAgICAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLm5vbmNlID8gb3B0aW9ucy5ub25jZSA6IHZvaWQgMFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIG51bGwgPT0gb3B0aW9ucyAmJiBJbnRlcm5hbHMuZC5NKGhyZWYpO1xuICAgIH07XG4gICAgZXhwb3J0cy5wcmVsb2FkID0gZnVuY3Rpb24gKGhyZWYsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBlbmNvdW50ZXJlZCA9IFwiXCI7XG4gICAgICAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIGhyZWYgJiYgaHJlZikgfHxcbiAgICAgICAgKGVuY291bnRlcmVkICs9XG4gICAgICAgICAgXCIgVGhlIGBocmVmYCBhcmd1bWVudCBlbmNvdW50ZXJlZCB3YXMgXCIgK1xuICAgICAgICAgIGdldFZhbHVlRGVzY3JpcHRvckV4cGVjdGluZ09iamVjdEZvcldhcm5pbmcoaHJlZikgK1xuICAgICAgICAgIFwiLlwiKTtcbiAgICAgIG51bGwgPT0gb3B0aW9ucyB8fCBcIm9iamVjdFwiICE9PSB0eXBlb2Ygb3B0aW9uc1xuICAgICAgICA/IChlbmNvdW50ZXJlZCArPVxuICAgICAgICAgICAgXCIgVGhlIGBvcHRpb25zYCBhcmd1bWVudCBlbmNvdW50ZXJlZCB3YXMgXCIgK1xuICAgICAgICAgICAgZ2V0VmFsdWVEZXNjcmlwdG9yRXhwZWN0aW5nT2JqZWN0Rm9yV2FybmluZyhvcHRpb25zKSArXG4gICAgICAgICAgICBcIi5cIilcbiAgICAgICAgOiAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIG9wdGlvbnMuYXMgJiYgb3B0aW9ucy5hcykgfHxcbiAgICAgICAgICAoZW5jb3VudGVyZWQgKz1cbiAgICAgICAgICAgIFwiIFRoZSBgYXNgIG9wdGlvbiBlbmNvdW50ZXJlZCB3YXMgXCIgK1xuICAgICAgICAgICAgZ2V0VmFsdWVEZXNjcmlwdG9yRXhwZWN0aW5nT2JqZWN0Rm9yV2FybmluZyhvcHRpb25zLmFzKSArXG4gICAgICAgICAgICBcIi5cIik7XG4gICAgICBlbmNvdW50ZXJlZCAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICdSZWFjdERPTS5wcmVsb2FkKCk6IEV4cGVjdGVkIHR3byBhcmd1bWVudHMsIGEgbm9uLWVtcHR5IGBocmVmYCBzdHJpbmcgYW5kIGFuIGBvcHRpb25zYCBvYmplY3Qgd2l0aCBhbiBgYXNgIHByb3BlcnR5IHZhbGlkIGZvciBhIGA8bGluayByZWw9XCJwcmVsb2FkXCIgYXM9XCIuLi5cIiAvPmAgdGFnLiVzJyxcbiAgICAgICAgICBlbmNvdW50ZXJlZFxuICAgICAgICApO1xuICAgICAgaWYgKFxuICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2YgaHJlZiAmJlxuICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2Ygb3B0aW9ucyAmJlxuICAgICAgICBudWxsICE9PSBvcHRpb25zICYmXG4gICAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLmFzXG4gICAgICApIHtcbiAgICAgICAgZW5jb3VudGVyZWQgPSBvcHRpb25zLmFzO1xuICAgICAgICB2YXIgY3Jvc3NPcmlnaW4gPSBnZXRDcm9zc09yaWdpblN0cmluZ0FzKFxuICAgICAgICAgIGVuY291bnRlcmVkLFxuICAgICAgICAgIG9wdGlvbnMuY3Jvc3NPcmlnaW5cbiAgICAgICAgKTtcbiAgICAgICAgSW50ZXJuYWxzLmQuTChocmVmLCBlbmNvdW50ZXJlZCwge1xuICAgICAgICAgIGNyb3NzT3JpZ2luOiBjcm9zc09yaWdpbixcbiAgICAgICAgICBpbnRlZ3JpdHk6XG4gICAgICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2Ygb3B0aW9ucy5pbnRlZ3JpdHkgPyBvcHRpb25zLmludGVncml0eSA6IHZvaWQgMCxcbiAgICAgICAgICBub25jZTogXCJzdHJpbmdcIiA9PT0gdHlwZW9mIG9wdGlvbnMubm9uY2UgPyBvcHRpb25zLm5vbmNlIDogdm9pZCAwLFxuICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLnR5cGUgPyBvcHRpb25zLnR5cGUgOiB2b2lkIDAsXG4gICAgICAgICAgZmV0Y2hQcmlvcml0eTpcbiAgICAgICAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLmZldGNoUHJpb3JpdHlcbiAgICAgICAgICAgICAgPyBvcHRpb25zLmZldGNoUHJpb3JpdHlcbiAgICAgICAgICAgICAgOiB2b2lkIDAsXG4gICAgICAgICAgcmVmZXJyZXJQb2xpY3k6XG4gICAgICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2Ygb3B0aW9ucy5yZWZlcnJlclBvbGljeVxuICAgICAgICAgICAgICA/IG9wdGlvbnMucmVmZXJyZXJQb2xpY3lcbiAgICAgICAgICAgICAgOiB2b2lkIDAsXG4gICAgICAgICAgaW1hZ2VTcmNTZXQ6XG4gICAgICAgICAgICBcInN0cmluZ1wiID09PSB0eXBlb2Ygb3B0aW9ucy5pbWFnZVNyY1NldFxuICAgICAgICAgICAgICA/IG9wdGlvbnMuaW1hZ2VTcmNTZXRcbiAgICAgICAgICAgICAgOiB2b2lkIDAsXG4gICAgICAgICAgaW1hZ2VTaXplczpcbiAgICAgICAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLmltYWdlU2l6ZXNcbiAgICAgICAgICAgICAgPyBvcHRpb25zLmltYWdlU2l6ZXNcbiAgICAgICAgICAgICAgOiB2b2lkIDAsXG4gICAgICAgICAgbWVkaWE6IFwic3RyaW5nXCIgPT09IHR5cGVvZiBvcHRpb25zLm1lZGlhID8gb3B0aW9ucy5tZWRpYSA6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGV4cG9ydHMucHJlbG9hZE1vZHVsZSA9IGZ1bmN0aW9uIChocmVmLCBvcHRpb25zKSB7XG4gICAgICB2YXIgZW5jb3VudGVyZWQgPSBcIlwiO1xuICAgICAgKFwic3RyaW5nXCIgPT09IHR5cGVvZiBocmVmICYmIGhyZWYpIHx8XG4gICAgICAgIChlbmNvdW50ZXJlZCArPVxuICAgICAgICAgIFwiIFRoZSBgaHJlZmAgYXJndW1lbnQgZW5jb3VudGVyZWQgd2FzIFwiICtcbiAgICAgICAgICBnZXRWYWx1ZURlc2NyaXB0b3JFeHBlY3RpbmdPYmplY3RGb3JXYXJuaW5nKGhyZWYpICtcbiAgICAgICAgICBcIi5cIik7XG4gICAgICB2b2lkIDAgIT09IG9wdGlvbnMgJiYgXCJvYmplY3RcIiAhPT0gdHlwZW9mIG9wdGlvbnNcbiAgICAgICAgPyAoZW5jb3VudGVyZWQgKz1cbiAgICAgICAgICAgIFwiIFRoZSBgb3B0aW9uc2AgYXJndW1lbnQgZW5jb3VudGVyZWQgd2FzIFwiICtcbiAgICAgICAgICAgIGdldFZhbHVlRGVzY3JpcHRvckV4cGVjdGluZ09iamVjdEZvcldhcm5pbmcob3B0aW9ucykgK1xuICAgICAgICAgICAgXCIuXCIpXG4gICAgICAgIDogb3B0aW9ucyAmJlxuICAgICAgICAgIFwiYXNcIiBpbiBvcHRpb25zICYmXG4gICAgICAgICAgXCJzdHJpbmdcIiAhPT0gdHlwZW9mIG9wdGlvbnMuYXMgJiZcbiAgICAgICAgICAoZW5jb3VudGVyZWQgKz1cbiAgICAgICAgICAgIFwiIFRoZSBgYXNgIG9wdGlvbiBlbmNvdW50ZXJlZCB3YXMgXCIgK1xuICAgICAgICAgICAgZ2V0VmFsdWVEZXNjcmlwdG9yRXhwZWN0aW5nT2JqZWN0Rm9yV2FybmluZyhvcHRpb25zLmFzKSArXG4gICAgICAgICAgICBcIi5cIik7XG4gICAgICBlbmNvdW50ZXJlZCAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICdSZWFjdERPTS5wcmVsb2FkTW9kdWxlKCk6IEV4cGVjdGVkIHR3byBhcmd1bWVudHMsIGEgbm9uLWVtcHR5IGBocmVmYCBzdHJpbmcgYW5kLCBvcHRpb25hbGx5LCBhbiBgb3B0aW9uc2Agb2JqZWN0IHdpdGggYW4gYGFzYCBwcm9wZXJ0eSB2YWxpZCBmb3IgYSBgPGxpbmsgcmVsPVwibW9kdWxlcHJlbG9hZFwiIGFzPVwiLi4uXCIgLz5gIHRhZy4lcycsXG4gICAgICAgICAgZW5jb3VudGVyZWRcbiAgICAgICAgKTtcbiAgICAgIFwic3RyaW5nXCIgPT09IHR5cGVvZiBocmVmICYmXG4gICAgICAgIChvcHRpb25zXG4gICAgICAgICAgPyAoKGVuY291bnRlcmVkID0gZ2V0Q3Jvc3NPcmlnaW5TdHJpbmdBcyhcbiAgICAgICAgICAgICAgb3B0aW9ucy5hcyxcbiAgICAgICAgICAgICAgb3B0aW9ucy5jcm9zc09yaWdpblxuICAgICAgICAgICAgKSksXG4gICAgICAgICAgICBJbnRlcm5hbHMuZC5tKGhyZWYsIHtcbiAgICAgICAgICAgICAgYXM6XG4gICAgICAgICAgICAgICAgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIG9wdGlvbnMuYXMgJiYgXCJzY3JpcHRcIiAhPT0gb3B0aW9ucy5hc1xuICAgICAgICAgICAgICAgICAgPyBvcHRpb25zLmFzXG4gICAgICAgICAgICAgICAgICA6IHZvaWQgMCxcbiAgICAgICAgICAgICAgY3Jvc3NPcmlnaW46IGVuY291bnRlcmVkLFxuICAgICAgICAgICAgICBpbnRlZ3JpdHk6XG4gICAgICAgICAgICAgICAgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIG9wdGlvbnMuaW50ZWdyaXR5XG4gICAgICAgICAgICAgICAgICA/IG9wdGlvbnMuaW50ZWdyaXR5XG4gICAgICAgICAgICAgICAgICA6IHZvaWQgMFxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgOiBJbnRlcm5hbHMuZC5tKGhyZWYpKTtcbiAgICB9O1xuICAgIGV4cG9ydHMucmVxdWVzdEZvcm1SZXNldCA9IGZ1bmN0aW9uIChmb3JtKSB7XG4gICAgICBJbnRlcm5hbHMuZC5yKGZvcm0pO1xuICAgIH07XG4gICAgZXhwb3J0cy51bnN0YWJsZV9iYXRjaGVkVXBkYXRlcyA9IGZ1bmN0aW9uIChmbiwgYSkge1xuICAgICAgcmV0dXJuIGZuKGEpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VGb3JtU3RhdGUgPSBmdW5jdGlvbiAoYWN0aW9uLCBpbml0aWFsU3RhdGUsIHBlcm1hbGluaykge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlRm9ybVN0YXRlKGFjdGlvbiwgaW5pdGlhbFN0YXRlLCBwZXJtYWxpbmspO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VGb3JtU3RhdHVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlSG9zdFRyYW5zaXRpb25TdGF0dXMoKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudmVyc2lvbiA9IFwiMTkuMi4zXCI7XG4gICAgXCJ1bmRlZmluZWRcIiAhPT0gdHlwZW9mIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXyAmJlxuICAgICAgXCJmdW5jdGlvblwiID09PVxuICAgICAgICB0eXBlb2YgX19SRUFDVF9ERVZUT09MU19HTE9CQUxfSE9PS19fLnJlZ2lzdGVySW50ZXJuYWxNb2R1bGVTdG9wICYmXG4gICAgICBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18ucmVnaXN0ZXJJbnRlcm5hbE1vZHVsZVN0b3AoRXJyb3IoKSk7XG4gIH0pKCk7XG4iLAogICAgIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gY2hlY2tEQ0UoKSB7XG4gIC8qIGdsb2JhbCBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18gKi9cbiAgaWYgKFxuICAgIHR5cGVvZiBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18gPT09ICd1bmRlZmluZWQnIHx8XG4gICAgdHlwZW9mIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5jaGVja0RDRSAhPT0gJ2Z1bmN0aW9uJ1xuICApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAvLyBUaGlzIGJyYW5jaCBpcyB1bnJlYWNoYWJsZSBiZWNhdXNlIHRoaXMgZnVuY3Rpb24gaXMgb25seSBjYWxsZWRcbiAgICAvLyBpbiBwcm9kdWN0aW9uLCBidXQgdGhlIGNvbmRpdGlvbiBpcyB0cnVlIG9ubHkgaW4gZGV2ZWxvcG1lbnQuXG4gICAgLy8gVGhlcmVmb3JlIGlmIHRoZSBicmFuY2ggaXMgc3RpbGwgaGVyZSwgZGVhZCBjb2RlIGVsaW1pbmF0aW9uIHdhc24ndFxuICAgIC8vIHByb3Blcmx5IGFwcGxpZWQuXG4gICAgLy8gRG9uJ3QgY2hhbmdlIHRoZSBtZXNzYWdlLiBSZWFjdCBEZXZUb29scyByZWxpZXMgb24gaXQuIEFsc28gbWFrZSBzdXJlXG4gICAgLy8gdGhpcyBtZXNzYWdlIGRvZXNuJ3Qgb2NjdXIgZWxzZXdoZXJlIGluIHRoaXMgZnVuY3Rpb24sIG9yIGl0IHdpbGwgY2F1c2VcbiAgICAvLyBhIGZhbHNlIHBvc2l0aXZlLlxuICAgIHRocm93IG5ldyBFcnJvcignXl9eJyk7XG4gIH1cbiAgdHJ5IHtcbiAgICAvLyBWZXJpZnkgdGhhdCB0aGUgY29kZSBhYm92ZSBoYXMgYmVlbiBkZWFkIGNvZGUgZWxpbWluYXRlZCAoRENFJ2QpLlxuICAgIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5jaGVja0RDRShjaGVja0RDRSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIC8vIERldlRvb2xzIHNob3VsZG4ndCBjcmFzaCBSZWFjdCwgbm8gbWF0dGVyIHdoYXQuXG4gICAgLy8gV2Ugc2hvdWxkIHN0aWxsIHJlcG9ydCBpbiBjYXNlIHdlIGJyZWFrIHRoaXMgY29kZS5cbiAgICBjb25zb2xlLmVycm9yKGVycik7XG4gIH1cbn1cblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicpIHtcbiAgLy8gRENFIGNoZWNrIHNob3VsZCBoYXBwZW4gYmVmb3JlIFJlYWN0RE9NIGJ1bmRsZSBleGVjdXRlcyBzbyB0aGF0XG4gIC8vIERldlRvb2xzIGNhbiByZXBvcnQgYmFkIG1pbmlmaWNhdGlvbiBkdXJpbmcgaW5qZWN0aW9uLlxuICBjaGVja0RDRSgpO1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LWRvbS5wcm9kdWN0aW9uLmpzJyk7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LWRvbS5kZXZlbG9wbWVudC5qcycpO1xufVxuIiwKICAgICIvLyBzcmMvdGltZW91dE1hbmFnZXIudHNcbnZhciBkZWZhdWx0VGltZW91dFByb3ZpZGVyID0ge1xuICAvLyBXZSBuZWVkIHRoZSB3cmFwcGVyIGZ1bmN0aW9uIHN5bnRheCBiZWxvdyBpbnN0ZWFkIG9mIGRpcmVjdCByZWZlcmVuY2VzIHRvXG4gIC8vIGdsb2JhbCBzZXRUaW1lb3V0IGV0Yy5cbiAgLy9cbiAgLy8gQkFEOiBgc2V0VGltZW91dDogc2V0VGltZW91dGBcbiAgLy8gR09PRDogYHNldFRpbWVvdXQ6IChjYiwgZGVsYXkpID0+IHNldFRpbWVvdXQoY2IsIGRlbGF5KWBcbiAgLy9cbiAgLy8gSWYgd2UgdXNlIGRpcmVjdCByZWZlcmVuY2VzIGhlcmUsIHRoZW4gYW55dGhpbmcgdGhhdCB3YW50cyB0byBzcHkgb24gb3JcbiAgLy8gcmVwbGFjZSB0aGUgZ2xvYmFsIHNldFRpbWVvdXQgKGxpa2UgdGVzdHMpIHdvbid0IHdvcmsgc2luY2Ugd2UnbGwgYWxyZWFkeVxuICAvLyBoYXZlIGEgaGFyZCByZWZlcmVuY2UgdG8gdGhlIG9yaWdpbmFsIGltcGxlbWVudGF0aW9uIGF0IHRoZSB0aW1lIHdoZW4gdGhpc1xuICAvLyBmaWxlIHdhcyBpbXBvcnRlZC5cbiAgc2V0VGltZW91dDogKGNhbGxiYWNrLCBkZWxheSkgPT4gc2V0VGltZW91dChjYWxsYmFjaywgZGVsYXkpLFxuICBjbGVhclRpbWVvdXQ6ICh0aW1lb3V0SWQpID0+IGNsZWFyVGltZW91dCh0aW1lb3V0SWQpLFxuICBzZXRJbnRlcnZhbDogKGNhbGxiYWNrLCBkZWxheSkgPT4gc2V0SW50ZXJ2YWwoY2FsbGJhY2ssIGRlbGF5KSxcbiAgY2xlYXJJbnRlcnZhbDogKGludGVydmFsSWQpID0+IGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWxJZClcbn07XG52YXIgVGltZW91dE1hbmFnZXIgPSBjbGFzcyB7XG4gIC8vIFdlIGNhbm5vdCBoYXZlIFRpbWVvdXRNYW5hZ2VyPFQ+IGFzIHdlIG11c3QgaW5zdGFudGlhdGUgaXQgd2l0aCBhIGNvbmNyZXRlXG4gIC8vIHR5cGUgYXQgYXBwIGJvb3Q7IGFuZCBpZiB3ZSBsZWF2ZSB0aGF0IHR5cGUsIHRoZW4gYW55IG5ldyB0aW1lciBwcm92aWRlclxuICAvLyB3b3VsZCBuZWVkIHRvIHN1cHBvcnQgUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4sIHdoaWNoIGlzIGluZmVhc2libGUuXG4gIC8vXG4gIC8vIFdlIHNldHRsZSBmb3IgdHlwZSBzYWZldHkgZm9yIHRoZSBUaW1lb3V0UHJvdmlkZXIgdHlwZSwgYW5kIGFjY2VwdCB0aGF0XG4gIC8vIHRoaXMgY2xhc3MgaXMgdW5zYWZlIGludGVybmFsbHkgdG8gYWxsb3cgZm9yIGV4dGVuc2lvbi5cbiAgI3Byb3ZpZGVyID0gZGVmYXVsdFRpbWVvdXRQcm92aWRlcjtcbiAgI3Byb3ZpZGVyQ2FsbGVkID0gZmFsc2U7XG4gIHNldFRpbWVvdXRQcm92aWRlcihwcm92aWRlcikge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICAgIGlmICh0aGlzLiNwcm92aWRlckNhbGxlZCAmJiBwcm92aWRlciAhPT0gdGhpcy4jcHJvdmlkZXIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBgW3RpbWVvdXRNYW5hZ2VyXTogU3dpdGNoaW5nIHByb3ZpZGVyIGFmdGVyIGNhbGxzIHRvIHByZXZpb3VzIHByb3ZpZGVyIG1pZ2h0IHJlc3VsdCBpbiB1bmV4cGVjdGVkIGJlaGF2aW9yLmAsXG4gICAgICAgICAgeyBwcmV2aW91czogdGhpcy4jcHJvdmlkZXIsIHByb3ZpZGVyIH1cbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy4jcHJvdmlkZXIgPSBwcm92aWRlcjtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgICB0aGlzLiNwcm92aWRlckNhbGxlZCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuICBzZXRUaW1lb3V0KGNhbGxiYWNrLCBkZWxheSkge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICAgIHRoaXMuI3Byb3ZpZGVyQ2FsbGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuI3Byb3ZpZGVyLnNldFRpbWVvdXQoY2FsbGJhY2ssIGRlbGF5KTtcbiAgfVxuICBjbGVhclRpbWVvdXQodGltZW91dElkKSB7XG4gICAgdGhpcy4jcHJvdmlkZXIuY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gIH1cbiAgc2V0SW50ZXJ2YWwoY2FsbGJhY2ssIGRlbGF5KSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSBcInByb2R1Y3Rpb25cIikge1xuICAgICAgdGhpcy4jcHJvdmlkZXJDYWxsZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy4jcHJvdmlkZXIuc2V0SW50ZXJ2YWwoY2FsbGJhY2ssIGRlbGF5KTtcbiAgfVxuICBjbGVhckludGVydmFsKGludGVydmFsSWQpIHtcbiAgICB0aGlzLiNwcm92aWRlci5jbGVhckludGVydmFsKGludGVydmFsSWQpO1xuICB9XG59O1xudmFyIHRpbWVvdXRNYW5hZ2VyID0gbmV3IFRpbWVvdXRNYW5hZ2VyKCk7XG5mdW5jdGlvbiBzeXN0ZW1TZXRUaW1lb3V0WmVybyhjYWxsYmFjaykge1xuICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcbn1cbmV4cG9ydCB7XG4gIFRpbWVvdXRNYW5hZ2VyLFxuICBkZWZhdWx0VGltZW91dFByb3ZpZGVyLFxuICBzeXN0ZW1TZXRUaW1lb3V0WmVybyxcbiAgdGltZW91dE1hbmFnZXJcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD10aW1lb3V0TWFuYWdlci5qcy5tYXAiLAogICAgIi8vIHNyYy91dGlscy50c1xuaW1wb3J0IHsgdGltZW91dE1hbmFnZXIgfSBmcm9tIFwiLi90aW1lb3V0TWFuYWdlci5qc1wiO1xudmFyIGlzU2VydmVyID0gdHlwZW9mIHdpbmRvdyA9PT0gXCJ1bmRlZmluZWRcIiB8fCBcIkRlbm9cIiBpbiBnbG9iYWxUaGlzO1xuZnVuY3Rpb24gbm9vcCgpIHtcbn1cbmZ1bmN0aW9uIGZ1bmN0aW9uYWxVcGRhdGUodXBkYXRlciwgaW5wdXQpIHtcbiAgcmV0dXJuIHR5cGVvZiB1cGRhdGVyID09PSBcImZ1bmN0aW9uXCIgPyB1cGRhdGVyKGlucHV0KSA6IHVwZGF0ZXI7XG59XG5mdW5jdGlvbiBpc1ZhbGlkVGltZW91dCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiICYmIHZhbHVlID49IDAgJiYgdmFsdWUgIT09IEluZmluaXR5O1xufVxuZnVuY3Rpb24gdGltZVVudGlsU3RhbGUodXBkYXRlZEF0LCBzdGFsZVRpbWUpIHtcbiAgcmV0dXJuIE1hdGgubWF4KHVwZGF0ZWRBdCArIChzdGFsZVRpbWUgfHwgMCkgLSBEYXRlLm5vdygpLCAwKTtcbn1cbmZ1bmN0aW9uIHJlc29sdmVTdGFsZVRpbWUoc3RhbGVUaW1lLCBxdWVyeSkge1xuICByZXR1cm4gdHlwZW9mIHN0YWxlVGltZSA9PT0gXCJmdW5jdGlvblwiID8gc3RhbGVUaW1lKHF1ZXJ5KSA6IHN0YWxlVGltZTtcbn1cbmZ1bmN0aW9uIHJlc29sdmVFbmFibGVkKGVuYWJsZWQsIHF1ZXJ5KSB7XG4gIHJldHVybiB0eXBlb2YgZW5hYmxlZCA9PT0gXCJmdW5jdGlvblwiID8gZW5hYmxlZChxdWVyeSkgOiBlbmFibGVkO1xufVxuZnVuY3Rpb24gbWF0Y2hRdWVyeShmaWx0ZXJzLCBxdWVyeSkge1xuICBjb25zdCB7XG4gICAgdHlwZSA9IFwiYWxsXCIsXG4gICAgZXhhY3QsXG4gICAgZmV0Y2hTdGF0dXMsXG4gICAgcHJlZGljYXRlLFxuICAgIHF1ZXJ5S2V5LFxuICAgIHN0YWxlXG4gIH0gPSBmaWx0ZXJzO1xuICBpZiAocXVlcnlLZXkpIHtcbiAgICBpZiAoZXhhY3QpIHtcbiAgICAgIGlmIChxdWVyeS5xdWVyeUhhc2ggIT09IGhhc2hRdWVyeUtleUJ5T3B0aW9ucyhxdWVyeUtleSwgcXVlcnkub3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIXBhcnRpYWxNYXRjaEtleShxdWVyeS5xdWVyeUtleSwgcXVlcnlLZXkpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGlmICh0eXBlICE9PSBcImFsbFwiKSB7XG4gICAgY29uc3QgaXNBY3RpdmUgPSBxdWVyeS5pc0FjdGl2ZSgpO1xuICAgIGlmICh0eXBlID09PSBcImFjdGl2ZVwiICYmICFpc0FjdGl2ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodHlwZSA9PT0gXCJpbmFjdGl2ZVwiICYmIGlzQWN0aXZlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGlmICh0eXBlb2Ygc3RhbGUgPT09IFwiYm9vbGVhblwiICYmIHF1ZXJ5LmlzU3RhbGUoKSAhPT0gc3RhbGUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGZldGNoU3RhdHVzICYmIGZldGNoU3RhdHVzICE9PSBxdWVyeS5zdGF0ZS5mZXRjaFN0YXR1cykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAocHJlZGljYXRlICYmICFwcmVkaWNhdGUocXVlcnkpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuZnVuY3Rpb24gbWF0Y2hNdXRhdGlvbihmaWx0ZXJzLCBtdXRhdGlvbikge1xuICBjb25zdCB7IGV4YWN0LCBzdGF0dXMsIHByZWRpY2F0ZSwgbXV0YXRpb25LZXkgfSA9IGZpbHRlcnM7XG4gIGlmIChtdXRhdGlvbktleSkge1xuICAgIGlmICghbXV0YXRpb24ub3B0aW9ucy5tdXRhdGlvbktleSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoZXhhY3QpIHtcbiAgICAgIGlmIChoYXNoS2V5KG11dGF0aW9uLm9wdGlvbnMubXV0YXRpb25LZXkpICE9PSBoYXNoS2V5KG11dGF0aW9uS2V5KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghcGFydGlhbE1hdGNoS2V5KG11dGF0aW9uLm9wdGlvbnMubXV0YXRpb25LZXksIG11dGF0aW9uS2V5KSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBpZiAoc3RhdHVzICYmIG11dGF0aW9uLnN0YXRlLnN0YXR1cyAhPT0gc3RhdHVzKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChwcmVkaWNhdGUgJiYgIXByZWRpY2F0ZShtdXRhdGlvbikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5mdW5jdGlvbiBoYXNoUXVlcnlLZXlCeU9wdGlvbnMocXVlcnlLZXksIG9wdGlvbnMpIHtcbiAgY29uc3QgaGFzaEZuID0gb3B0aW9ucz8ucXVlcnlLZXlIYXNoRm4gfHwgaGFzaEtleTtcbiAgcmV0dXJuIGhhc2hGbihxdWVyeUtleSk7XG59XG5mdW5jdGlvbiBoYXNoS2V5KHF1ZXJ5S2V5KSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShcbiAgICBxdWVyeUtleSxcbiAgICAoXywgdmFsKSA9PiBpc1BsYWluT2JqZWN0KHZhbCkgPyBPYmplY3Qua2V5cyh2YWwpLnNvcnQoKS5yZWR1Y2UoKHJlc3VsdCwga2V5KSA9PiB7XG4gICAgICByZXN1bHRba2V5XSA9IHZhbFtrZXldO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LCB7fSkgOiB2YWxcbiAgKTtcbn1cbmZ1bmN0aW9uIHBhcnRpYWxNYXRjaEtleShhLCBiKSB7XG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKHR5cGVvZiBhICE9PSB0eXBlb2YgYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoYSAmJiBiICYmIHR5cGVvZiBhID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBiID09PSBcIm9iamVjdFwiKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGIpLmV2ZXJ5KChrZXkpID0+IHBhcnRpYWxNYXRjaEtleShhW2tleV0sIGJba2V5XSkpO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuZnVuY3Rpb24gcmVwbGFjZUVxdWFsRGVlcChhLCBiKSB7XG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIGE7XG4gIH1cbiAgY29uc3QgYXJyYXkgPSBpc1BsYWluQXJyYXkoYSkgJiYgaXNQbGFpbkFycmF5KGIpO1xuICBpZiAoIWFycmF5ICYmICEoaXNQbGFpbk9iamVjdChhKSAmJiBpc1BsYWluT2JqZWN0KGIpKSkgcmV0dXJuIGI7XG4gIGNvbnN0IGFJdGVtcyA9IGFycmF5ID8gYSA6IE9iamVjdC5rZXlzKGEpO1xuICBjb25zdCBhU2l6ZSA9IGFJdGVtcy5sZW5ndGg7XG4gIGNvbnN0IGJJdGVtcyA9IGFycmF5ID8gYiA6IE9iamVjdC5rZXlzKGIpO1xuICBjb25zdCBiU2l6ZSA9IGJJdGVtcy5sZW5ndGg7XG4gIGNvbnN0IGNvcHkgPSBhcnJheSA/IG5ldyBBcnJheShiU2l6ZSkgOiB7fTtcbiAgbGV0IGVxdWFsSXRlbXMgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGJTaXplOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBhcnJheSA/IGkgOiBiSXRlbXNbaV07XG4gICAgY29uc3QgYUl0ZW0gPSBhW2tleV07XG4gICAgY29uc3QgYkl0ZW0gPSBiW2tleV07XG4gICAgaWYgKGFJdGVtID09PSBiSXRlbSkge1xuICAgICAgY29weVtrZXldID0gYUl0ZW07XG4gICAgICBpZiAoYXJyYXkgPyBpIDwgYVNpemUgOiBoYXNPd24uY2FsbChhLCBrZXkpKSBlcXVhbEl0ZW1zKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGFJdGVtID09PSBudWxsIHx8IGJJdGVtID09PSBudWxsIHx8IHR5cGVvZiBhSXRlbSAhPT0gXCJvYmplY3RcIiB8fCB0eXBlb2YgYkl0ZW0gIT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGNvcHlba2V5XSA9IGJJdGVtO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHYgPSByZXBsYWNlRXF1YWxEZWVwKGFJdGVtLCBiSXRlbSk7XG4gICAgY29weVtrZXldID0gdjtcbiAgICBpZiAodiA9PT0gYUl0ZW0pIGVxdWFsSXRlbXMrKztcbiAgfVxuICByZXR1cm4gYVNpemUgPT09IGJTaXplICYmIGVxdWFsSXRlbXMgPT09IGFTaXplID8gYSA6IGNvcHk7XG59XG5mdW5jdGlvbiBzaGFsbG93RXF1YWxPYmplY3RzKGEsIGIpIHtcbiAgaWYgKCFiIHx8IE9iamVjdC5rZXlzKGEpLmxlbmd0aCAhPT0gT2JqZWN0LmtleXMoYikubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAoY29uc3Qga2V5IGluIGEpIHtcbiAgICBpZiAoYVtrZXldICE9PSBiW2tleV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5mdW5jdGlvbiBpc1BsYWluQXJyYXkodmFsdWUpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gT2JqZWN0LmtleXModmFsdWUpLmxlbmd0aDtcbn1cbmZ1bmN0aW9uIGlzUGxhaW5PYmplY3Qobykge1xuICBpZiAoIWhhc09iamVjdFByb3RvdHlwZShvKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBjdG9yID0gby5jb25zdHJ1Y3RvcjtcbiAgaWYgKGN0b3IgPT09IHZvaWQgMCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGNvbnN0IHByb3QgPSBjdG9yLnByb3RvdHlwZTtcbiAgaWYgKCFoYXNPYmplY3RQcm90b3R5cGUocHJvdCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKCFwcm90Lmhhc093blByb3BlcnR5KFwiaXNQcm90b3R5cGVPZlwiKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKG8pICE9PSBPYmplY3QucHJvdG90eXBlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuZnVuY3Rpb24gaGFzT2JqZWN0UHJvdG90eXBlKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKSA9PT0gXCJbb2JqZWN0IE9iamVjdF1cIjtcbn1cbmZ1bmN0aW9uIHNsZWVwKHRpbWVvdXQpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgdGltZW91dE1hbmFnZXIuc2V0VGltZW91dChyZXNvbHZlLCB0aW1lb3V0KTtcbiAgfSk7XG59XG5mdW5jdGlvbiByZXBsYWNlRGF0YShwcmV2RGF0YSwgZGF0YSwgb3B0aW9ucykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMuc3RydWN0dXJhbFNoYXJpbmcgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHJldHVybiBvcHRpb25zLnN0cnVjdHVyYWxTaGFyaW5nKHByZXZEYXRhLCBkYXRhKTtcbiAgfSBlbHNlIGlmIChvcHRpb25zLnN0cnVjdHVyYWxTaGFyaW5nICE9PSBmYWxzZSkge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZXBsYWNlRXF1YWxEZWVwKHByZXZEYXRhLCBkYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgYFN0cnVjdHVyYWwgc2hhcmluZyByZXF1aXJlcyBkYXRhIHRvIGJlIEpTT04gc2VyaWFsaXphYmxlLiBUbyBmaXggdGhpcywgdHVybiBvZmYgc3RydWN0dXJhbFNoYXJpbmcgb3IgcmV0dXJuIEpTT04tc2VyaWFsaXphYmxlIGRhdGEgZnJvbSB5b3VyIHF1ZXJ5Rm4uIFske29wdGlvbnMucXVlcnlIYXNofV06ICR7ZXJyb3J9YFxuICAgICAgICApO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlcGxhY2VFcXVhbERlZXAocHJldkRhdGEsIGRhdGEpO1xuICB9XG4gIHJldHVybiBkYXRhO1xufVxuZnVuY3Rpb24ga2VlcFByZXZpb3VzRGF0YShwcmV2aW91c0RhdGEpIHtcbiAgcmV0dXJuIHByZXZpb3VzRGF0YTtcbn1cbmZ1bmN0aW9uIGFkZFRvRW5kKGl0ZW1zLCBpdGVtLCBtYXggPSAwKSB7XG4gIGNvbnN0IG5ld0l0ZW1zID0gWy4uLml0ZW1zLCBpdGVtXTtcbiAgcmV0dXJuIG1heCAmJiBuZXdJdGVtcy5sZW5ndGggPiBtYXggPyBuZXdJdGVtcy5zbGljZSgxKSA6IG5ld0l0ZW1zO1xufVxuZnVuY3Rpb24gYWRkVG9TdGFydChpdGVtcywgaXRlbSwgbWF4ID0gMCkge1xuICBjb25zdCBuZXdJdGVtcyA9IFtpdGVtLCAuLi5pdGVtc107XG4gIHJldHVybiBtYXggJiYgbmV3SXRlbXMubGVuZ3RoID4gbWF4ID8gbmV3SXRlbXMuc2xpY2UoMCwgLTEpIDogbmV3SXRlbXM7XG59XG52YXIgc2tpcFRva2VuID0gU3ltYm9sKCk7XG5mdW5jdGlvbiBlbnN1cmVRdWVyeUZuKG9wdGlvbnMsIGZldGNoT3B0aW9ucykge1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgaWYgKG9wdGlvbnMucXVlcnlGbiA9PT0gc2tpcFRva2VuKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBgQXR0ZW1wdGVkIHRvIGludm9rZSBxdWVyeUZuIHdoZW4gc2V0IHRvIHNraXBUb2tlbi4gVGhpcyBpcyBsaWtlbHkgYSBjb25maWd1cmF0aW9uIGVycm9yLiBRdWVyeSBoYXNoOiAnJHtvcHRpb25zLnF1ZXJ5SGFzaH0nYFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFvcHRpb25zLnF1ZXJ5Rm4gJiYgZmV0Y2hPcHRpb25zPy5pbml0aWFsUHJvbWlzZSkge1xuICAgIHJldHVybiAoKSA9PiBmZXRjaE9wdGlvbnMuaW5pdGlhbFByb21pc2U7XG4gIH1cbiAgaWYgKCFvcHRpb25zLnF1ZXJ5Rm4gfHwgb3B0aW9ucy5xdWVyeUZuID09PSBza2lwVG9rZW4pIHtcbiAgICByZXR1cm4gKCkgPT4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGBNaXNzaW5nIHF1ZXJ5Rm46ICcke29wdGlvbnMucXVlcnlIYXNofSdgKSk7XG4gIH1cbiAgcmV0dXJuIG9wdGlvbnMucXVlcnlGbjtcbn1cbmZ1bmN0aW9uIHNob3VsZFRocm93RXJyb3IodGhyb3dPbkVycm9yLCBwYXJhbXMpIHtcbiAgaWYgKHR5cGVvZiB0aHJvd09uRXJyb3IgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHJldHVybiB0aHJvd09uRXJyb3IoLi4ucGFyYW1zKTtcbiAgfVxuICByZXR1cm4gISF0aHJvd09uRXJyb3I7XG59XG5leHBvcnQge1xuICBhZGRUb0VuZCxcbiAgYWRkVG9TdGFydCxcbiAgZW5zdXJlUXVlcnlGbixcbiAgZnVuY3Rpb25hbFVwZGF0ZSxcbiAgaGFzaEtleSxcbiAgaGFzaFF1ZXJ5S2V5QnlPcHRpb25zLFxuICBpc1BsYWluQXJyYXksXG4gIGlzUGxhaW5PYmplY3QsXG4gIGlzU2VydmVyLFxuICBpc1ZhbGlkVGltZW91dCxcbiAga2VlcFByZXZpb3VzRGF0YSxcbiAgbWF0Y2hNdXRhdGlvbixcbiAgbWF0Y2hRdWVyeSxcbiAgbm9vcCxcbiAgcGFydGlhbE1hdGNoS2V5LFxuICByZXBsYWNlRGF0YSxcbiAgcmVwbGFjZUVxdWFsRGVlcCxcbiAgcmVzb2x2ZUVuYWJsZWQsXG4gIHJlc29sdmVTdGFsZVRpbWUsXG4gIHNoYWxsb3dFcXVhbE9iamVjdHMsXG4gIHNob3VsZFRocm93RXJyb3IsXG4gIHNraXBUb2tlbixcbiAgc2xlZXAsXG4gIHRpbWVVbnRpbFN0YWxlXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXRpbHMuanMubWFwIiwKICAgICIvLyBzcmMvbm90aWZ5TWFuYWdlci50c1xuaW1wb3J0IHsgc3lzdGVtU2V0VGltZW91dFplcm8gfSBmcm9tIFwiLi90aW1lb3V0TWFuYWdlci5qc1wiO1xudmFyIGRlZmF1bHRTY2hlZHVsZXIgPSBzeXN0ZW1TZXRUaW1lb3V0WmVybztcbmZ1bmN0aW9uIGNyZWF0ZU5vdGlmeU1hbmFnZXIoKSB7XG4gIGxldCBxdWV1ZSA9IFtdO1xuICBsZXQgdHJhbnNhY3Rpb25zID0gMDtcbiAgbGV0IG5vdGlmeUZuID0gKGNhbGxiYWNrKSA9PiB7XG4gICAgY2FsbGJhY2soKTtcbiAgfTtcbiAgbGV0IGJhdGNoTm90aWZ5Rm4gPSAoY2FsbGJhY2spID0+IHtcbiAgICBjYWxsYmFjaygpO1xuICB9O1xuICBsZXQgc2NoZWR1bGVGbiA9IGRlZmF1bHRTY2hlZHVsZXI7XG4gIGNvbnN0IHNjaGVkdWxlID0gKGNhbGxiYWNrKSA9PiB7XG4gICAgaWYgKHRyYW5zYWN0aW9ucykge1xuICAgICAgcXVldWUucHVzaChjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNjaGVkdWxlRm4oKCkgPT4ge1xuICAgICAgICBub3RpZnlGbihjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGZsdXNoID0gKCkgPT4ge1xuICAgIGNvbnN0IG9yaWdpbmFsUXVldWUgPSBxdWV1ZTtcbiAgICBxdWV1ZSA9IFtdO1xuICAgIGlmIChvcmlnaW5hbFF1ZXVlLmxlbmd0aCkge1xuICAgICAgc2NoZWR1bGVGbigoKSA9PiB7XG4gICAgICAgIGJhdGNoTm90aWZ5Rm4oKCkgPT4ge1xuICAgICAgICAgIG9yaWdpbmFsUXVldWUuZm9yRWFjaCgoY2FsbGJhY2spID0+IHtcbiAgICAgICAgICAgIG5vdGlmeUZuKGNhbGxiYWNrKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG4gIHJldHVybiB7XG4gICAgYmF0Y2g6IChjYWxsYmFjaykgPT4ge1xuICAgICAgbGV0IHJlc3VsdDtcbiAgICAgIHRyYW5zYWN0aW9ucysrO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2soKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHRyYW5zYWN0aW9ucy0tO1xuICAgICAgICBpZiAoIXRyYW5zYWN0aW9ucykge1xuICAgICAgICAgIGZsdXNoKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBBbGwgY2FsbHMgdG8gdGhlIHdyYXBwZWQgZnVuY3Rpb24gd2lsbCBiZSBiYXRjaGVkLlxuICAgICAqL1xuICAgIGJhdGNoQ2FsbHM6IChjYWxsYmFjaykgPT4ge1xuICAgICAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgICAgIHNjaGVkdWxlKCgpID0+IHtcbiAgICAgICAgICBjYWxsYmFjayguLi5hcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIH0sXG4gICAgc2NoZWR1bGUsXG4gICAgLyoqXG4gICAgICogVXNlIHRoaXMgbWV0aG9kIHRvIHNldCBhIGN1c3RvbSBub3RpZnkgZnVuY3Rpb24uXG4gICAgICogVGhpcyBjYW4gYmUgdXNlZCB0byBmb3IgZXhhbXBsZSB3cmFwIG5vdGlmaWNhdGlvbnMgd2l0aCBgUmVhY3QuYWN0YCB3aGlsZSBydW5uaW5nIHRlc3RzLlxuICAgICAqL1xuICAgIHNldE5vdGlmeUZ1bmN0aW9uOiAoZm4pID0+IHtcbiAgICAgIG5vdGlmeUZuID0gZm47XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBVc2UgdGhpcyBtZXRob2QgdG8gc2V0IGEgY3VzdG9tIGZ1bmN0aW9uIHRvIGJhdGNoIG5vdGlmaWNhdGlvbnMgdG9nZXRoZXIgaW50byBhIHNpbmdsZSB0aWNrLlxuICAgICAqIEJ5IGRlZmF1bHQgUmVhY3QgUXVlcnkgd2lsbCB1c2UgdGhlIGJhdGNoIGZ1bmN0aW9uIHByb3ZpZGVkIGJ5IFJlYWN0RE9NIG9yIFJlYWN0IE5hdGl2ZS5cbiAgICAgKi9cbiAgICBzZXRCYXRjaE5vdGlmeUZ1bmN0aW9uOiAoZm4pID0+IHtcbiAgICAgIGJhdGNoTm90aWZ5Rm4gPSBmbjtcbiAgICB9LFxuICAgIHNldFNjaGVkdWxlcjogKGZuKSA9PiB7XG4gICAgICBzY2hlZHVsZUZuID0gZm47XG4gICAgfVxuICB9O1xufVxudmFyIG5vdGlmeU1hbmFnZXIgPSBjcmVhdGVOb3RpZnlNYW5hZ2VyKCk7XG5leHBvcnQge1xuICBjcmVhdGVOb3RpZnlNYW5hZ2VyLFxuICBkZWZhdWx0U2NoZWR1bGVyLFxuICBub3RpZnlNYW5hZ2VyXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bm90aWZ5TWFuYWdlci5qcy5tYXAiLAogICAgIi8vIHNyYy9zdWJzY3JpYmFibGUudHNcbnZhciBTdWJzY3JpYmFibGUgPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubGlzdGVuZXJzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgICB0aGlzLnN1YnNjcmliZSA9IHRoaXMuc3Vic2NyaWJlLmJpbmQodGhpcyk7XG4gIH1cbiAgc3Vic2NyaWJlKGxpc3RlbmVyKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMuYWRkKGxpc3RlbmVyKTtcbiAgICB0aGlzLm9uU3Vic2NyaWJlKCk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMubGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7XG4gICAgICB0aGlzLm9uVW5zdWJzY3JpYmUoKTtcbiAgICB9O1xuICB9XG4gIGhhc0xpc3RlbmVycygpIHtcbiAgICByZXR1cm4gdGhpcy5saXN0ZW5lcnMuc2l6ZSA+IDA7XG4gIH1cbiAgb25TdWJzY3JpYmUoKSB7XG4gIH1cbiAgb25VbnN1YnNjcmliZSgpIHtcbiAgfVxufTtcbmV4cG9ydCB7XG4gIFN1YnNjcmliYWJsZVxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN1YnNjcmliYWJsZS5qcy5tYXAiLAogICAgIi8vIHNyYy9mb2N1c01hbmFnZXIudHNcbmltcG9ydCB7IFN1YnNjcmliYWJsZSB9IGZyb20gXCIuL3N1YnNjcmliYWJsZS5qc1wiO1xuaW1wb3J0IHsgaXNTZXJ2ZXIgfSBmcm9tIFwiLi91dGlscy5qc1wiO1xudmFyIEZvY3VzTWFuYWdlciA9IGNsYXNzIGV4dGVuZHMgU3Vic2NyaWJhYmxlIHtcbiAgI2ZvY3VzZWQ7XG4gICNjbGVhbnVwO1xuICAjc2V0dXA7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy4jc2V0dXAgPSAob25Gb2N1cykgPT4ge1xuICAgICAgaWYgKCFpc1NlcnZlciAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBjb25zdCBsaXN0ZW5lciA9ICgpID0+IG9uRm9jdXMoKTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJ2aXNpYmlsaXR5Y2hhbmdlXCIsIGxpc3RlbmVyLCBmYWxzZSk7XG4gICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ2aXNpYmlsaXR5Y2hhbmdlXCIsIGxpc3RlbmVyKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9O1xuICB9XG4gIG9uU3Vic2NyaWJlKCkge1xuICAgIGlmICghdGhpcy4jY2xlYW51cCkge1xuICAgICAgdGhpcy5zZXRFdmVudExpc3RlbmVyKHRoaXMuI3NldHVwKTtcbiAgICB9XG4gIH1cbiAgb25VbnN1YnNjcmliZSgpIHtcbiAgICBpZiAoIXRoaXMuaGFzTGlzdGVuZXJzKCkpIHtcbiAgICAgIHRoaXMuI2NsZWFudXA/LigpO1xuICAgICAgdGhpcy4jY2xlYW51cCA9IHZvaWQgMDtcbiAgICB9XG4gIH1cbiAgc2V0RXZlbnRMaXN0ZW5lcihzZXR1cCkge1xuICAgIHRoaXMuI3NldHVwID0gc2V0dXA7XG4gICAgdGhpcy4jY2xlYW51cD8uKCk7XG4gICAgdGhpcy4jY2xlYW51cCA9IHNldHVwKChmb2N1c2VkKSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGZvY3VzZWQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHRoaXMuc2V0Rm9jdXNlZChmb2N1c2VkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub25Gb2N1cygpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHNldEZvY3VzZWQoZm9jdXNlZCkge1xuICAgIGNvbnN0IGNoYW5nZWQgPSB0aGlzLiNmb2N1c2VkICE9PSBmb2N1c2VkO1xuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICB0aGlzLiNmb2N1c2VkID0gZm9jdXNlZDtcbiAgICAgIHRoaXMub25Gb2N1cygpO1xuICAgIH1cbiAgfVxuICBvbkZvY3VzKCkge1xuICAgIGNvbnN0IGlzRm9jdXNlZCA9IHRoaXMuaXNGb2N1c2VkKCk7XG4gICAgdGhpcy5saXN0ZW5lcnMuZm9yRWFjaCgobGlzdGVuZXIpID0+IHtcbiAgICAgIGxpc3RlbmVyKGlzRm9jdXNlZCk7XG4gICAgfSk7XG4gIH1cbiAgaXNGb2N1c2VkKCkge1xuICAgIGlmICh0eXBlb2YgdGhpcy4jZm9jdXNlZCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgIHJldHVybiB0aGlzLiNmb2N1c2VkO1xuICAgIH1cbiAgICByZXR1cm4gZ2xvYmFsVGhpcy5kb2N1bWVudD8udmlzaWJpbGl0eVN0YXRlICE9PSBcImhpZGRlblwiO1xuICB9XG59O1xudmFyIGZvY3VzTWFuYWdlciA9IG5ldyBGb2N1c01hbmFnZXIoKTtcbmV4cG9ydCB7XG4gIEZvY3VzTWFuYWdlcixcbiAgZm9jdXNNYW5hZ2VyXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Zm9jdXNNYW5hZ2VyLmpzLm1hcCIsCiAgICAiLy8gc3JjL29ubGluZU1hbmFnZXIudHNcbmltcG9ydCB7IFN1YnNjcmliYWJsZSB9IGZyb20gXCIuL3N1YnNjcmliYWJsZS5qc1wiO1xuaW1wb3J0IHsgaXNTZXJ2ZXIgfSBmcm9tIFwiLi91dGlscy5qc1wiO1xudmFyIE9ubGluZU1hbmFnZXIgPSBjbGFzcyBleHRlbmRzIFN1YnNjcmliYWJsZSB7XG4gICNvbmxpbmUgPSB0cnVlO1xuICAjY2xlYW51cDtcbiAgI3NldHVwO1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuI3NldHVwID0gKG9uT25saW5lKSA9PiB7XG4gICAgICBpZiAoIWlzU2VydmVyICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIGNvbnN0IG9ubGluZUxpc3RlbmVyID0gKCkgPT4gb25PbmxpbmUodHJ1ZSk7XG4gICAgICAgIGNvbnN0IG9mZmxpbmVMaXN0ZW5lciA9ICgpID0+IG9uT25saW5lKGZhbHNlKTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJvbmxpbmVcIiwgb25saW5lTGlzdGVuZXIsIGZhbHNlKTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJvZmZsaW5lXCIsIG9mZmxpbmVMaXN0ZW5lciwgZmFsc2UpO1xuICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwib25saW5lXCIsIG9ubGluZUxpc3RlbmVyKTtcbiAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm9mZmxpbmVcIiwgb2ZmbGluZUxpc3RlbmVyKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9O1xuICB9XG4gIG9uU3Vic2NyaWJlKCkge1xuICAgIGlmICghdGhpcy4jY2xlYW51cCkge1xuICAgICAgdGhpcy5zZXRFdmVudExpc3RlbmVyKHRoaXMuI3NldHVwKTtcbiAgICB9XG4gIH1cbiAgb25VbnN1YnNjcmliZSgpIHtcbiAgICBpZiAoIXRoaXMuaGFzTGlzdGVuZXJzKCkpIHtcbiAgICAgIHRoaXMuI2NsZWFudXA/LigpO1xuICAgICAgdGhpcy4jY2xlYW51cCA9IHZvaWQgMDtcbiAgICB9XG4gIH1cbiAgc2V0RXZlbnRMaXN0ZW5lcihzZXR1cCkge1xuICAgIHRoaXMuI3NldHVwID0gc2V0dXA7XG4gICAgdGhpcy4jY2xlYW51cD8uKCk7XG4gICAgdGhpcy4jY2xlYW51cCA9IHNldHVwKHRoaXMuc2V0T25saW5lLmJpbmQodGhpcykpO1xuICB9XG4gIHNldE9ubGluZShvbmxpbmUpIHtcbiAgICBjb25zdCBjaGFuZ2VkID0gdGhpcy4jb25saW5lICE9PSBvbmxpbmU7XG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIHRoaXMuI29ubGluZSA9IG9ubGluZTtcbiAgICAgIHRoaXMubGlzdGVuZXJzLmZvckVhY2goKGxpc3RlbmVyKSA9PiB7XG4gICAgICAgIGxpc3RlbmVyKG9ubGluZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgaXNPbmxpbmUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI29ubGluZTtcbiAgfVxufTtcbnZhciBvbmxpbmVNYW5hZ2VyID0gbmV3IE9ubGluZU1hbmFnZXIoKTtcbmV4cG9ydCB7XG4gIE9ubGluZU1hbmFnZXIsXG4gIG9ubGluZU1hbmFnZXJcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1vbmxpbmVNYW5hZ2VyLmpzLm1hcCIsCiAgICAiLy8gc3JjL3RoZW5hYmxlLnRzXG5pbXBvcnQgeyBub29wIH0gZnJvbSBcIi4vdXRpbHMuanNcIjtcbmZ1bmN0aW9uIHBlbmRpbmdUaGVuYWJsZSgpIHtcbiAgbGV0IHJlc29sdmU7XG4gIGxldCByZWplY3Q7XG4gIGNvbnN0IHRoZW5hYmxlID0gbmV3IFByb21pc2UoKF9yZXNvbHZlLCBfcmVqZWN0KSA9PiB7XG4gICAgcmVzb2x2ZSA9IF9yZXNvbHZlO1xuICAgIHJlamVjdCA9IF9yZWplY3Q7XG4gIH0pO1xuICB0aGVuYWJsZS5zdGF0dXMgPSBcInBlbmRpbmdcIjtcbiAgdGhlbmFibGUuY2F0Y2goKCkgPT4ge1xuICB9KTtcbiAgZnVuY3Rpb24gZmluYWxpemUoZGF0YSkge1xuICAgIE9iamVjdC5hc3NpZ24odGhlbmFibGUsIGRhdGEpO1xuICAgIGRlbGV0ZSB0aGVuYWJsZS5yZXNvbHZlO1xuICAgIGRlbGV0ZSB0aGVuYWJsZS5yZWplY3Q7XG4gIH1cbiAgdGhlbmFibGUucmVzb2x2ZSA9ICh2YWx1ZSkgPT4ge1xuICAgIGZpbmFsaXplKHtcbiAgICAgIHN0YXR1czogXCJmdWxmaWxsZWRcIixcbiAgICAgIHZhbHVlXG4gICAgfSk7XG4gICAgcmVzb2x2ZSh2YWx1ZSk7XG4gIH07XG4gIHRoZW5hYmxlLnJlamVjdCA9IChyZWFzb24pID0+IHtcbiAgICBmaW5hbGl6ZSh7XG4gICAgICBzdGF0dXM6IFwicmVqZWN0ZWRcIixcbiAgICAgIHJlYXNvblxuICAgIH0pO1xuICAgIHJlamVjdChyZWFzb24pO1xuICB9O1xuICByZXR1cm4gdGhlbmFibGU7XG59XG5mdW5jdGlvbiB0cnlSZXNvbHZlU3luYyhwcm9taXNlKSB7XG4gIGxldCBkYXRhO1xuICBwcm9taXNlLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgIGRhdGEgPSByZXN1bHQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSwgbm9vcCk/LmNhdGNoKG5vb3ApO1xuICBpZiAoZGF0YSAhPT0gdm9pZCAwKSB7XG4gICAgcmV0dXJuIHsgZGF0YSB9O1xuICB9XG4gIHJldHVybiB2b2lkIDA7XG59XG5leHBvcnQge1xuICBwZW5kaW5nVGhlbmFibGUsXG4gIHRyeVJlc29sdmVTeW5jXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dGhlbmFibGUuanMubWFwIiwKICAgICIvLyBzcmMvcmV0cnllci50c1xuaW1wb3J0IHsgZm9jdXNNYW5hZ2VyIH0gZnJvbSBcIi4vZm9jdXNNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBvbmxpbmVNYW5hZ2VyIH0gZnJvbSBcIi4vb25saW5lTWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgcGVuZGluZ1RoZW5hYmxlIH0gZnJvbSBcIi4vdGhlbmFibGUuanNcIjtcbmltcG9ydCB7IGlzU2VydmVyLCBzbGVlcCB9IGZyb20gXCIuL3V0aWxzLmpzXCI7XG5mdW5jdGlvbiBkZWZhdWx0UmV0cnlEZWxheShmYWlsdXJlQ291bnQpIHtcbiAgcmV0dXJuIE1hdGgubWluKDFlMyAqIDIgKiogZmFpbHVyZUNvdW50LCAzZTQpO1xufVxuZnVuY3Rpb24gY2FuRmV0Y2gobmV0d29ya01vZGUpIHtcbiAgcmV0dXJuIChuZXR3b3JrTW9kZSA/PyBcIm9ubGluZVwiKSA9PT0gXCJvbmxpbmVcIiA/IG9ubGluZU1hbmFnZXIuaXNPbmxpbmUoKSA6IHRydWU7XG59XG52YXIgQ2FuY2VsbGVkRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKFwiQ2FuY2VsbGVkRXJyb3JcIik7XG4gICAgdGhpcy5yZXZlcnQgPSBvcHRpb25zPy5yZXZlcnQ7XG4gICAgdGhpcy5zaWxlbnQgPSBvcHRpb25zPy5zaWxlbnQ7XG4gIH1cbn07XG5mdW5jdGlvbiBpc0NhbmNlbGxlZEVycm9yKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhbmNlbGxlZEVycm9yO1xufVxuZnVuY3Rpb24gY3JlYXRlUmV0cnllcihjb25maWcpIHtcbiAgbGV0IGlzUmV0cnlDYW5jZWxsZWQgPSBmYWxzZTtcbiAgbGV0IGZhaWx1cmVDb3VudCA9IDA7XG4gIGxldCBjb250aW51ZUZuO1xuICBjb25zdCB0aGVuYWJsZSA9IHBlbmRpbmdUaGVuYWJsZSgpO1xuICBjb25zdCBpc1Jlc29sdmVkID0gKCkgPT4gdGhlbmFibGUuc3RhdHVzICE9PSBcInBlbmRpbmdcIjtcbiAgY29uc3QgY2FuY2VsID0gKGNhbmNlbE9wdGlvbnMpID0+IHtcbiAgICBpZiAoIWlzUmVzb2x2ZWQoKSkge1xuICAgICAgY29uc3QgZXJyb3IgPSBuZXcgQ2FuY2VsbGVkRXJyb3IoY2FuY2VsT3B0aW9ucyk7XG4gICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgY29uZmlnLm9uQ2FuY2VsPy4oZXJyb3IpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgY2FuY2VsUmV0cnkgPSAoKSA9PiB7XG4gICAgaXNSZXRyeUNhbmNlbGxlZCA9IHRydWU7XG4gIH07XG4gIGNvbnN0IGNvbnRpbnVlUmV0cnkgPSAoKSA9PiB7XG4gICAgaXNSZXRyeUNhbmNlbGxlZCA9IGZhbHNlO1xuICB9O1xuICBjb25zdCBjYW5Db250aW51ZSA9ICgpID0+IGZvY3VzTWFuYWdlci5pc0ZvY3VzZWQoKSAmJiAoY29uZmlnLm5ldHdvcmtNb2RlID09PSBcImFsd2F5c1wiIHx8IG9ubGluZU1hbmFnZXIuaXNPbmxpbmUoKSkgJiYgY29uZmlnLmNhblJ1bigpO1xuICBjb25zdCBjYW5TdGFydCA9ICgpID0+IGNhbkZldGNoKGNvbmZpZy5uZXR3b3JrTW9kZSkgJiYgY29uZmlnLmNhblJ1bigpO1xuICBjb25zdCByZXNvbHZlID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKCFpc1Jlc29sdmVkKCkpIHtcbiAgICAgIGNvbnRpbnVlRm4/LigpO1xuICAgICAgdGhlbmFibGUucmVzb2x2ZSh2YWx1ZSk7XG4gICAgfVxuICB9O1xuICBjb25zdCByZWplY3QgPSAodmFsdWUpID0+IHtcbiAgICBpZiAoIWlzUmVzb2x2ZWQoKSkge1xuICAgICAgY29udGludWVGbj8uKCk7XG4gICAgICB0aGVuYWJsZS5yZWplY3QodmFsdWUpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgcGF1c2UgPSAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChjb250aW51ZVJlc29sdmUpID0+IHtcbiAgICAgIGNvbnRpbnVlRm4gPSAodmFsdWUpID0+IHtcbiAgICAgICAgaWYgKGlzUmVzb2x2ZWQoKSB8fCBjYW5Db250aW51ZSgpKSB7XG4gICAgICAgICAgY29udGludWVSZXNvbHZlKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGNvbmZpZy5vblBhdXNlPy4oKTtcbiAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgIGNvbnRpbnVlRm4gPSB2b2lkIDA7XG4gICAgICBpZiAoIWlzUmVzb2x2ZWQoKSkge1xuICAgICAgICBjb25maWcub25Db250aW51ZT8uKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG4gIGNvbnN0IHJ1biA9ICgpID0+IHtcbiAgICBpZiAoaXNSZXNvbHZlZCgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCBwcm9taXNlT3JWYWx1ZTtcbiAgICBjb25zdCBpbml0aWFsUHJvbWlzZSA9IGZhaWx1cmVDb3VudCA9PT0gMCA/IGNvbmZpZy5pbml0aWFsUHJvbWlzZSA6IHZvaWQgMDtcbiAgICB0cnkge1xuICAgICAgcHJvbWlzZU9yVmFsdWUgPSBpbml0aWFsUHJvbWlzZSA/PyBjb25maWcuZm4oKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcHJvbWlzZU9yVmFsdWUgPSBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gICAgfVxuICAgIFByb21pc2UucmVzb2x2ZShwcm9taXNlT3JWYWx1ZSkudGhlbihyZXNvbHZlKS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgIGlmIChpc1Jlc29sdmVkKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgcmV0cnkgPSBjb25maWcucmV0cnkgPz8gKGlzU2VydmVyID8gMCA6IDMpO1xuICAgICAgY29uc3QgcmV0cnlEZWxheSA9IGNvbmZpZy5yZXRyeURlbGF5ID8/IGRlZmF1bHRSZXRyeURlbGF5O1xuICAgICAgY29uc3QgZGVsYXkgPSB0eXBlb2YgcmV0cnlEZWxheSA9PT0gXCJmdW5jdGlvblwiID8gcmV0cnlEZWxheShmYWlsdXJlQ291bnQsIGVycm9yKSA6IHJldHJ5RGVsYXk7XG4gICAgICBjb25zdCBzaG91bGRSZXRyeSA9IHJldHJ5ID09PSB0cnVlIHx8IHR5cGVvZiByZXRyeSA9PT0gXCJudW1iZXJcIiAmJiBmYWlsdXJlQ291bnQgPCByZXRyeSB8fCB0eXBlb2YgcmV0cnkgPT09IFwiZnVuY3Rpb25cIiAmJiByZXRyeShmYWlsdXJlQ291bnQsIGVycm9yKTtcbiAgICAgIGlmIChpc1JldHJ5Q2FuY2VsbGVkIHx8ICFzaG91bGRSZXRyeSkge1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmYWlsdXJlQ291bnQrKztcbiAgICAgIGNvbmZpZy5vbkZhaWw/LihmYWlsdXJlQ291bnQsIGVycm9yKTtcbiAgICAgIHNsZWVwKGRlbGF5KS50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIGNhbkNvbnRpbnVlKCkgPyB2b2lkIDAgOiBwYXVzZSgpO1xuICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgIGlmIChpc1JldHJ5Q2FuY2VsbGVkKSB7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBydW4oKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG4gIHJldHVybiB7XG4gICAgcHJvbWlzZTogdGhlbmFibGUsXG4gICAgc3RhdHVzOiAoKSA9PiB0aGVuYWJsZS5zdGF0dXMsXG4gICAgY2FuY2VsLFxuICAgIGNvbnRpbnVlOiAoKSA9PiB7XG4gICAgICBjb250aW51ZUZuPy4oKTtcbiAgICAgIHJldHVybiB0aGVuYWJsZTtcbiAgICB9LFxuICAgIGNhbmNlbFJldHJ5LFxuICAgIGNvbnRpbnVlUmV0cnksXG4gICAgY2FuU3RhcnQsXG4gICAgc3RhcnQ6ICgpID0+IHtcbiAgICAgIGlmIChjYW5TdGFydCgpKSB7XG4gICAgICAgIHJ1bigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGF1c2UoKS50aGVuKHJ1bik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhlbmFibGU7XG4gICAgfVxuICB9O1xufVxuZXhwb3J0IHtcbiAgQ2FuY2VsbGVkRXJyb3IsXG4gIGNhbkZldGNoLFxuICBjcmVhdGVSZXRyeWVyLFxuICBpc0NhbmNlbGxlZEVycm9yXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cmV0cnllci5qcy5tYXAiLAogICAgIi8vIHNyYy9yZW1vdmFibGUudHNcbmltcG9ydCB7IHRpbWVvdXRNYW5hZ2VyIH0gZnJvbSBcIi4vdGltZW91dE1hbmFnZXIuanNcIjtcbmltcG9ydCB7IGlzU2VydmVyLCBpc1ZhbGlkVGltZW91dCB9IGZyb20gXCIuL3V0aWxzLmpzXCI7XG52YXIgUmVtb3ZhYmxlID0gY2xhc3Mge1xuICAjZ2NUaW1lb3V0O1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMuY2xlYXJHY1RpbWVvdXQoKTtcbiAgfVxuICBzY2hlZHVsZUdjKCkge1xuICAgIHRoaXMuY2xlYXJHY1RpbWVvdXQoKTtcbiAgICBpZiAoaXNWYWxpZFRpbWVvdXQodGhpcy5nY1RpbWUpKSB7XG4gICAgICB0aGlzLiNnY1RpbWVvdXQgPSB0aW1lb3V0TWFuYWdlci5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5vcHRpb25hbFJlbW92ZSgpO1xuICAgICAgfSwgdGhpcy5nY1RpbWUpO1xuICAgIH1cbiAgfVxuICB1cGRhdGVHY1RpbWUobmV3R2NUaW1lKSB7XG4gICAgdGhpcy5nY1RpbWUgPSBNYXRoLm1heChcbiAgICAgIHRoaXMuZ2NUaW1lIHx8IDAsXG4gICAgICBuZXdHY1RpbWUgPz8gKGlzU2VydmVyID8gSW5maW5pdHkgOiA1ICogNjAgKiAxZTMpXG4gICAgKTtcbiAgfVxuICBjbGVhckdjVGltZW91dCgpIHtcbiAgICBpZiAodGhpcy4jZ2NUaW1lb3V0KSB7XG4gICAgICB0aW1lb3V0TWFuYWdlci5jbGVhclRpbWVvdXQodGhpcy4jZ2NUaW1lb3V0KTtcbiAgICAgIHRoaXMuI2djVGltZW91dCA9IHZvaWQgMDtcbiAgICB9XG4gIH1cbn07XG5leHBvcnQge1xuICBSZW1vdmFibGVcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yZW1vdmFibGUuanMubWFwIiwKICAgICIvLyBzcmMvcXVlcnkudHNcbmltcG9ydCB7XG4gIGVuc3VyZVF1ZXJ5Rm4sXG4gIG5vb3AsXG4gIHJlcGxhY2VEYXRhLFxuICByZXNvbHZlRW5hYmxlZCxcbiAgcmVzb2x2ZVN0YWxlVGltZSxcbiAgc2tpcFRva2VuLFxuICB0aW1lVW50aWxTdGFsZVxufSBmcm9tIFwiLi91dGlscy5qc1wiO1xuaW1wb3J0IHsgbm90aWZ5TWFuYWdlciB9IGZyb20gXCIuL25vdGlmeU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IENhbmNlbGxlZEVycm9yLCBjYW5GZXRjaCwgY3JlYXRlUmV0cnllciB9IGZyb20gXCIuL3JldHJ5ZXIuanNcIjtcbmltcG9ydCB7IFJlbW92YWJsZSB9IGZyb20gXCIuL3JlbW92YWJsZS5qc1wiO1xudmFyIFF1ZXJ5ID0gY2xhc3MgZXh0ZW5kcyBSZW1vdmFibGUge1xuICAjaW5pdGlhbFN0YXRlO1xuICAjcmV2ZXJ0U3RhdGU7XG4gICNjYWNoZTtcbiAgI2NsaWVudDtcbiAgI3JldHJ5ZXI7XG4gICNkZWZhdWx0T3B0aW9ucztcbiAgI2Fib3J0U2lnbmFsQ29uc3VtZWQ7XG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy4jYWJvcnRTaWduYWxDb25zdW1lZCA9IGZhbHNlO1xuICAgIHRoaXMuI2RlZmF1bHRPcHRpb25zID0gY29uZmlnLmRlZmF1bHRPcHRpb25zO1xuICAgIHRoaXMuc2V0T3B0aW9ucyhjb25maWcub3B0aW9ucyk7XG4gICAgdGhpcy5vYnNlcnZlcnMgPSBbXTtcbiAgICB0aGlzLiNjbGllbnQgPSBjb25maWcuY2xpZW50O1xuICAgIHRoaXMuI2NhY2hlID0gdGhpcy4jY2xpZW50LmdldFF1ZXJ5Q2FjaGUoKTtcbiAgICB0aGlzLnF1ZXJ5S2V5ID0gY29uZmlnLnF1ZXJ5S2V5O1xuICAgIHRoaXMucXVlcnlIYXNoID0gY29uZmlnLnF1ZXJ5SGFzaDtcbiAgICB0aGlzLiNpbml0aWFsU3RhdGUgPSBnZXREZWZhdWx0U3RhdGUodGhpcy5vcHRpb25zKTtcbiAgICB0aGlzLnN0YXRlID0gY29uZmlnLnN0YXRlID8/IHRoaXMuI2luaXRpYWxTdGF0ZTtcbiAgICB0aGlzLnNjaGVkdWxlR2MoKTtcbiAgfVxuICBnZXQgbWV0YSgpIHtcbiAgICByZXR1cm4gdGhpcy5vcHRpb25zLm1ldGE7XG4gIH1cbiAgZ2V0IHByb21pc2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuI3JldHJ5ZXI/LnByb21pc2U7XG4gIH1cbiAgc2V0T3B0aW9ucyhvcHRpb25zKSB7XG4gICAgdGhpcy5vcHRpb25zID0geyAuLi50aGlzLiNkZWZhdWx0T3B0aW9ucywgLi4ub3B0aW9ucyB9O1xuICAgIHRoaXMudXBkYXRlR2NUaW1lKHRoaXMub3B0aW9ucy5nY1RpbWUpO1xuICAgIGlmICh0aGlzLnN0YXRlICYmIHRoaXMuc3RhdGUuZGF0YSA9PT0gdm9pZCAwKSB7XG4gICAgICBjb25zdCBkZWZhdWx0U3RhdGUgPSBnZXREZWZhdWx0U3RhdGUodGhpcy5vcHRpb25zKTtcbiAgICAgIGlmIChkZWZhdWx0U3RhdGUuZGF0YSAhPT0gdm9pZCAwKSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoXG4gICAgICAgICAgc3VjY2Vzc1N0YXRlKGRlZmF1bHRTdGF0ZS5kYXRhLCBkZWZhdWx0U3RhdGUuZGF0YVVwZGF0ZWRBdClcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy4jaW5pdGlhbFN0YXRlID0gZGVmYXVsdFN0YXRlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBvcHRpb25hbFJlbW92ZSgpIHtcbiAgICBpZiAoIXRoaXMub2JzZXJ2ZXJzLmxlbmd0aCAmJiB0aGlzLnN0YXRlLmZldGNoU3RhdHVzID09PSBcImlkbGVcIikge1xuICAgICAgdGhpcy4jY2FjaGUucmVtb3ZlKHRoaXMpO1xuICAgIH1cbiAgfVxuICBzZXREYXRhKG5ld0RhdGEsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBkYXRhID0gcmVwbGFjZURhdGEodGhpcy5zdGF0ZS5kYXRhLCBuZXdEYXRhLCB0aGlzLm9wdGlvbnMpO1xuICAgIHRoaXMuI2Rpc3BhdGNoKHtcbiAgICAgIGRhdGEsXG4gICAgICB0eXBlOiBcInN1Y2Nlc3NcIixcbiAgICAgIGRhdGFVcGRhdGVkQXQ6IG9wdGlvbnM/LnVwZGF0ZWRBdCxcbiAgICAgIG1hbnVhbDogb3B0aW9ucz8ubWFudWFsXG4gICAgfSk7XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cbiAgc2V0U3RhdGUoc3RhdGUsIHNldFN0YXRlT3B0aW9ucykge1xuICAgIHRoaXMuI2Rpc3BhdGNoKHsgdHlwZTogXCJzZXRTdGF0ZVwiLCBzdGF0ZSwgc2V0U3RhdGVPcHRpb25zIH0pO1xuICB9XG4gIGNhbmNlbChvcHRpb25zKSB7XG4gICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuI3JldHJ5ZXI/LnByb21pc2U7XG4gICAgdGhpcy4jcmV0cnllcj8uY2FuY2VsKG9wdGlvbnMpO1xuICAgIHJldHVybiBwcm9taXNlID8gcHJvbWlzZS50aGVuKG5vb3ApLmNhdGNoKG5vb3ApIDogUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbiAgZGVzdHJveSgpIHtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgdGhpcy5jYW5jZWwoeyBzaWxlbnQ6IHRydWUgfSk7XG4gIH1cbiAgcmVzZXQoKSB7XG4gICAgdGhpcy5kZXN0cm95KCk7XG4gICAgdGhpcy5zZXRTdGF0ZSh0aGlzLiNpbml0aWFsU3RhdGUpO1xuICB9XG4gIGlzQWN0aXZlKCkge1xuICAgIHJldHVybiB0aGlzLm9ic2VydmVycy5zb21lKFxuICAgICAgKG9ic2VydmVyKSA9PiByZXNvbHZlRW5hYmxlZChvYnNlcnZlci5vcHRpb25zLmVuYWJsZWQsIHRoaXMpICE9PSBmYWxzZVxuICAgICk7XG4gIH1cbiAgaXNEaXNhYmxlZCgpIHtcbiAgICBpZiAodGhpcy5nZXRPYnNlcnZlcnNDb3VudCgpID4gMCkge1xuICAgICAgcmV0dXJuICF0aGlzLmlzQWN0aXZlKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm9wdGlvbnMucXVlcnlGbiA9PT0gc2tpcFRva2VuIHx8IHRoaXMuc3RhdGUuZGF0YVVwZGF0ZUNvdW50ICsgdGhpcy5zdGF0ZS5lcnJvclVwZGF0ZUNvdW50ID09PSAwO1xuICB9XG4gIGlzU3RhdGljKCkge1xuICAgIGlmICh0aGlzLmdldE9ic2VydmVyc0NvdW50KCkgPiAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5vYnNlcnZlcnMuc29tZShcbiAgICAgICAgKG9ic2VydmVyKSA9PiByZXNvbHZlU3RhbGVUaW1lKG9ic2VydmVyLm9wdGlvbnMuc3RhbGVUaW1lLCB0aGlzKSA9PT0gXCJzdGF0aWNcIlxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlzU3RhbGUoKSB7XG4gICAgaWYgKHRoaXMuZ2V0T2JzZXJ2ZXJzQ291bnQoKSA+IDApIHtcbiAgICAgIHJldHVybiB0aGlzLm9ic2VydmVycy5zb21lKFxuICAgICAgICAob2JzZXJ2ZXIpID0+IG9ic2VydmVyLmdldEN1cnJlbnRSZXN1bHQoKS5pc1N0YWxlXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5kYXRhID09PSB2b2lkIDAgfHwgdGhpcy5zdGF0ZS5pc0ludmFsaWRhdGVkO1xuICB9XG4gIGlzU3RhbGVCeVRpbWUoc3RhbGVUaW1lID0gMCkge1xuICAgIGlmICh0aGlzLnN0YXRlLmRhdGEgPT09IHZvaWQgMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChzdGFsZVRpbWUgPT09IFwic3RhdGljXCIpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuc3RhdGUuaXNJbnZhbGlkYXRlZCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiAhdGltZVVudGlsU3RhbGUodGhpcy5zdGF0ZS5kYXRhVXBkYXRlZEF0LCBzdGFsZVRpbWUpO1xuICB9XG4gIG9uRm9jdXMoKSB7XG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVycy5maW5kKCh4KSA9PiB4LnNob3VsZEZldGNoT25XaW5kb3dGb2N1cygpKTtcbiAgICBvYnNlcnZlcj8ucmVmZXRjaCh7IGNhbmNlbFJlZmV0Y2g6IGZhbHNlIH0pO1xuICAgIHRoaXMuI3JldHJ5ZXI/LmNvbnRpbnVlKCk7XG4gIH1cbiAgb25PbmxpbmUoKSB7XG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVycy5maW5kKCh4KSA9PiB4LnNob3VsZEZldGNoT25SZWNvbm5lY3QoKSk7XG4gICAgb2JzZXJ2ZXI/LnJlZmV0Y2goeyBjYW5jZWxSZWZldGNoOiBmYWxzZSB9KTtcbiAgICB0aGlzLiNyZXRyeWVyPy5jb250aW51ZSgpO1xuICB9XG4gIGFkZE9ic2VydmVyKG9ic2VydmVyKSB7XG4gICAgaWYgKCF0aGlzLm9ic2VydmVycy5pbmNsdWRlcyhvYnNlcnZlcikpIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICAgICAgdGhpcy5jbGVhckdjVGltZW91dCgpO1xuICAgICAgdGhpcy4jY2FjaGUubm90aWZ5KHsgdHlwZTogXCJvYnNlcnZlckFkZGVkXCIsIHF1ZXJ5OiB0aGlzLCBvYnNlcnZlciB9KTtcbiAgICB9XG4gIH1cbiAgcmVtb3ZlT2JzZXJ2ZXIob2JzZXJ2ZXIpIHtcbiAgICBpZiAodGhpcy5vYnNlcnZlcnMuaW5jbHVkZXMob2JzZXJ2ZXIpKSB7XG4gICAgICB0aGlzLm9ic2VydmVycyA9IHRoaXMub2JzZXJ2ZXJzLmZpbHRlcigoeCkgPT4geCAhPT0gb2JzZXJ2ZXIpO1xuICAgICAgaWYgKCF0aGlzLm9ic2VydmVycy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHRoaXMuI3JldHJ5ZXIpIHtcbiAgICAgICAgICBpZiAodGhpcy4jYWJvcnRTaWduYWxDb25zdW1lZCkge1xuICAgICAgICAgICAgdGhpcy4jcmV0cnllci5jYW5jZWwoeyByZXZlcnQ6IHRydWUgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuI3JldHJ5ZXIuY2FuY2VsUmV0cnkoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zY2hlZHVsZUdjKCk7XG4gICAgICB9XG4gICAgICB0aGlzLiNjYWNoZS5ub3RpZnkoeyB0eXBlOiBcIm9ic2VydmVyUmVtb3ZlZFwiLCBxdWVyeTogdGhpcywgb2JzZXJ2ZXIgfSk7XG4gICAgfVxuICB9XG4gIGdldE9ic2VydmVyc0NvdW50KCkge1xuICAgIHJldHVybiB0aGlzLm9ic2VydmVycy5sZW5ndGg7XG4gIH1cbiAgaW52YWxpZGF0ZSgpIHtcbiAgICBpZiAoIXRoaXMuc3RhdGUuaXNJbnZhbGlkYXRlZCkge1xuICAgICAgdGhpcy4jZGlzcGF0Y2goeyB0eXBlOiBcImludmFsaWRhdGVcIiB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZmV0Y2gob3B0aW9ucywgZmV0Y2hPcHRpb25zKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUuZmV0Y2hTdGF0dXMgIT09IFwiaWRsZVwiICYmIC8vIElmIHRoZSBwcm9taXNlIGluIHRoZSByZXR5ZXIgaXMgYWxyZWFkeSByZWplY3RlZCwgd2UgaGF2ZSB0byBkZWZpbml0ZWx5XG4gICAgLy8gcmUtc3RhcnQgdGhlIGZldGNoOyB0aGVyZSBpcyBhIGNoYW5jZSB0aGF0IHRoZSBxdWVyeSBpcyBzdGlsbCBpbiBhXG4gICAgLy8gcGVuZGluZyBzdGF0ZSB3aGVuIHRoYXQgaGFwcGVuc1xuICAgIHRoaXMuI3JldHJ5ZXI/LnN0YXR1cygpICE9PSBcInJlamVjdGVkXCIpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlLmRhdGEgIT09IHZvaWQgMCAmJiBmZXRjaE9wdGlvbnM/LmNhbmNlbFJlZmV0Y2gpIHtcbiAgICAgICAgdGhpcy5jYW5jZWwoeyBzaWxlbnQ6IHRydWUgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuI3JldHJ5ZXIpIHtcbiAgICAgICAgdGhpcy4jcmV0cnllci5jb250aW51ZVJldHJ5KCk7XG4gICAgICAgIHJldHVybiB0aGlzLiNyZXRyeWVyLnByb21pc2U7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvcHRpb25zKSB7XG4gICAgICB0aGlzLnNldE9wdGlvbnMob3B0aW9ucyk7XG4gICAgfVxuICAgIGlmICghdGhpcy5vcHRpb25zLnF1ZXJ5Rm4pIHtcbiAgICAgIGNvbnN0IG9ic2VydmVyID0gdGhpcy5vYnNlcnZlcnMuZmluZCgoeCkgPT4geC5vcHRpb25zLnF1ZXJ5Rm4pO1xuICAgICAgaWYgKG9ic2VydmVyKSB7XG4gICAgICAgIHRoaXMuc2V0T3B0aW9ucyhvYnNlcnZlci5vcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSBcInByb2R1Y3Rpb25cIikge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHRoaXMub3B0aW9ucy5xdWVyeUtleSkpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBgQXMgb2YgdjQsIHF1ZXJ5S2V5IG5lZWRzIHRvIGJlIGFuIEFycmF5LiBJZiB5b3UgYXJlIHVzaW5nIGEgc3RyaW5nIGxpa2UgJ3JlcG9EYXRhJywgcGxlYXNlIGNoYW5nZSBpdCB0byBhbiBBcnJheSwgZS5nLiBbJ3JlcG9EYXRhJ11gXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCBhZGRTaWduYWxQcm9wZXJ0eSA9IChvYmplY3QpID0+IHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3QsIFwic2lnbmFsXCIsIHtcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgZ2V0OiAoKSA9PiB7XG4gICAgICAgICAgdGhpcy4jYWJvcnRTaWduYWxDb25zdW1lZCA9IHRydWU7XG4gICAgICAgICAgcmV0dXJuIGFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG4gICAgY29uc3QgZmV0Y2hGbiA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5Rm4gPSBlbnN1cmVRdWVyeUZuKHRoaXMub3B0aW9ucywgZmV0Y2hPcHRpb25zKTtcbiAgICAgIGNvbnN0IGNyZWF0ZVF1ZXJ5Rm5Db250ZXh0ID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBxdWVyeUZuQ29udGV4dDIgPSB7XG4gICAgICAgICAgY2xpZW50OiB0aGlzLiNjbGllbnQsXG4gICAgICAgICAgcXVlcnlLZXk6IHRoaXMucXVlcnlLZXksXG4gICAgICAgICAgbWV0YTogdGhpcy5tZXRhXG4gICAgICAgIH07XG4gICAgICAgIGFkZFNpZ25hbFByb3BlcnR5KHF1ZXJ5Rm5Db250ZXh0Mik7XG4gICAgICAgIHJldHVybiBxdWVyeUZuQ29udGV4dDI7XG4gICAgICB9O1xuICAgICAgY29uc3QgcXVlcnlGbkNvbnRleHQgPSBjcmVhdGVRdWVyeUZuQ29udGV4dCgpO1xuICAgICAgdGhpcy4jYWJvcnRTaWduYWxDb25zdW1lZCA9IGZhbHNlO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5wZXJzaXN0ZXIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5wZXJzaXN0ZXIoXG4gICAgICAgICAgcXVlcnlGbixcbiAgICAgICAgICBxdWVyeUZuQ29udGV4dCxcbiAgICAgICAgICB0aGlzXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcXVlcnlGbihxdWVyeUZuQ29udGV4dCk7XG4gICAgfTtcbiAgICBjb25zdCBjcmVhdGVGZXRjaENvbnRleHQgPSAoKSA9PiB7XG4gICAgICBjb25zdCBjb250ZXh0MiA9IHtcbiAgICAgICAgZmV0Y2hPcHRpb25zLFxuICAgICAgICBvcHRpb25zOiB0aGlzLm9wdGlvbnMsXG4gICAgICAgIHF1ZXJ5S2V5OiB0aGlzLnF1ZXJ5S2V5LFxuICAgICAgICBjbGllbnQ6IHRoaXMuI2NsaWVudCxcbiAgICAgICAgc3RhdGU6IHRoaXMuc3RhdGUsXG4gICAgICAgIGZldGNoRm5cbiAgICAgIH07XG4gICAgICBhZGRTaWduYWxQcm9wZXJ0eShjb250ZXh0Mik7XG4gICAgICByZXR1cm4gY29udGV4dDI7XG4gICAgfTtcbiAgICBjb25zdCBjb250ZXh0ID0gY3JlYXRlRmV0Y2hDb250ZXh0KCk7XG4gICAgdGhpcy5vcHRpb25zLmJlaGF2aW9yPy5vbkZldGNoKGNvbnRleHQsIHRoaXMpO1xuICAgIHRoaXMuI3JldmVydFN0YXRlID0gdGhpcy5zdGF0ZTtcbiAgICBpZiAodGhpcy5zdGF0ZS5mZXRjaFN0YXR1cyA9PT0gXCJpZGxlXCIgfHwgdGhpcy5zdGF0ZS5mZXRjaE1ldGEgIT09IGNvbnRleHQuZmV0Y2hPcHRpb25zPy5tZXRhKSB7XG4gICAgICB0aGlzLiNkaXNwYXRjaCh7IHR5cGU6IFwiZmV0Y2hcIiwgbWV0YTogY29udGV4dC5mZXRjaE9wdGlvbnM/Lm1ldGEgfSk7XG4gICAgfVxuICAgIHRoaXMuI3JldHJ5ZXIgPSBjcmVhdGVSZXRyeWVyKHtcbiAgICAgIGluaXRpYWxQcm9taXNlOiBmZXRjaE9wdGlvbnM/LmluaXRpYWxQcm9taXNlLFxuICAgICAgZm46IGNvbnRleHQuZmV0Y2hGbixcbiAgICAgIG9uQ2FuY2VsOiAoZXJyb3IpID0+IHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQ2FuY2VsbGVkRXJyb3IgJiYgZXJyb3IucmV2ZXJ0KSB7XG4gICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICAuLi50aGlzLiNyZXZlcnRTdGF0ZSxcbiAgICAgICAgICAgIGZldGNoU3RhdHVzOiBcImlkbGVcIlxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGFib3J0Q29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgfSxcbiAgICAgIG9uRmFpbDogKGZhaWx1cmVDb3VudCwgZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy4jZGlzcGF0Y2goeyB0eXBlOiBcImZhaWxlZFwiLCBmYWlsdXJlQ291bnQsIGVycm9yIH0pO1xuICAgICAgfSxcbiAgICAgIG9uUGF1c2U6ICgpID0+IHtcbiAgICAgICAgdGhpcy4jZGlzcGF0Y2goeyB0eXBlOiBcInBhdXNlXCIgfSk7XG4gICAgICB9LFxuICAgICAgb25Db250aW51ZTogKCkgPT4ge1xuICAgICAgICB0aGlzLiNkaXNwYXRjaCh7IHR5cGU6IFwiY29udGludWVcIiB9KTtcbiAgICAgIH0sXG4gICAgICByZXRyeTogY29udGV4dC5vcHRpb25zLnJldHJ5LFxuICAgICAgcmV0cnlEZWxheTogY29udGV4dC5vcHRpb25zLnJldHJ5RGVsYXksXG4gICAgICBuZXR3b3JrTW9kZTogY29udGV4dC5vcHRpb25zLm5ldHdvcmtNb2RlLFxuICAgICAgY2FuUnVuOiAoKSA9PiB0cnVlXG4gICAgfSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLiNyZXRyeWVyLnN0YXJ0KCk7XG4gICAgICBpZiAoZGF0YSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgYFF1ZXJ5IGRhdGEgY2Fubm90IGJlIHVuZGVmaW5lZC4gUGxlYXNlIG1ha2Ugc3VyZSB0byByZXR1cm4gYSB2YWx1ZSBvdGhlciB0aGFuIHVuZGVmaW5lZCBmcm9tIHlvdXIgcXVlcnkgZnVuY3Rpb24uIEFmZmVjdGVkIHF1ZXJ5IGtleTogJHt0aGlzLnF1ZXJ5SGFzaH1gXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7dGhpcy5xdWVyeUhhc2h9IGRhdGEgaXMgdW5kZWZpbmVkYCk7XG4gICAgICB9XG4gICAgICB0aGlzLnNldERhdGEoZGF0YSk7XG4gICAgICB0aGlzLiNjYWNoZS5jb25maWcub25TdWNjZXNzPy4oZGF0YSwgdGhpcyk7XG4gICAgICB0aGlzLiNjYWNoZS5jb25maWcub25TZXR0bGVkPy4oXG4gICAgICAgIGRhdGEsXG4gICAgICAgIHRoaXMuc3RhdGUuZXJyb3IsXG4gICAgICAgIHRoaXNcbiAgICAgICk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQ2FuY2VsbGVkRXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yLnNpbGVudCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLiNyZXRyeWVyLnByb21pc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoZXJyb3IucmV2ZXJ0KSB7XG4gICAgICAgICAgaWYgKHRoaXMuc3RhdGUuZGF0YSA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc3RhdGUuZGF0YTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy4jZGlzcGF0Y2goe1xuICAgICAgICB0eXBlOiBcImVycm9yXCIsXG4gICAgICAgIGVycm9yXG4gICAgICB9KTtcbiAgICAgIHRoaXMuI2NhY2hlLmNvbmZpZy5vbkVycm9yPy4oXG4gICAgICAgIGVycm9yLFxuICAgICAgICB0aGlzXG4gICAgICApO1xuICAgICAgdGhpcy4jY2FjaGUuY29uZmlnLm9uU2V0dGxlZD8uKFxuICAgICAgICB0aGlzLnN0YXRlLmRhdGEsXG4gICAgICAgIGVycm9yLFxuICAgICAgICB0aGlzXG4gICAgICApO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuc2NoZWR1bGVHYygpO1xuICAgIH1cbiAgfVxuICAjZGlzcGF0Y2goYWN0aW9uKSB7XG4gICAgY29uc3QgcmVkdWNlciA9IChzdGF0ZSkgPT4ge1xuICAgICAgc3dpdGNoIChhY3Rpb24udHlwZSkge1xuICAgICAgICBjYXNlIFwiZmFpbGVkXCI6XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnN0YXRlLFxuICAgICAgICAgICAgZmV0Y2hGYWlsdXJlQ291bnQ6IGFjdGlvbi5mYWlsdXJlQ291bnQsXG4gICAgICAgICAgICBmZXRjaEZhaWx1cmVSZWFzb246IGFjdGlvbi5lcnJvclxuICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgXCJwYXVzZVwiOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICAgIGZldGNoU3RhdHVzOiBcInBhdXNlZFwiXG4gICAgICAgICAgfTtcbiAgICAgICAgY2FzZSBcImNvbnRpbnVlXCI6XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnN0YXRlLFxuICAgICAgICAgICAgZmV0Y2hTdGF0dXM6IFwiZmV0Y2hpbmdcIlxuICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgXCJmZXRjaFwiOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICAgIC4uLmZldGNoU3RhdGUoc3RhdGUuZGF0YSwgdGhpcy5vcHRpb25zKSxcbiAgICAgICAgICAgIGZldGNoTWV0YTogYWN0aW9uLm1ldGEgPz8gbnVsbFxuICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgXCJzdWNjZXNzXCI6XG4gICAgICAgICAgY29uc3QgbmV3U3RhdGUgPSB7XG4gICAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICAgIC4uLnN1Y2Nlc3NTdGF0ZShhY3Rpb24uZGF0YSwgYWN0aW9uLmRhdGFVcGRhdGVkQXQpLFxuICAgICAgICAgICAgZGF0YVVwZGF0ZUNvdW50OiBzdGF0ZS5kYXRhVXBkYXRlQ291bnQgKyAxLFxuICAgICAgICAgICAgLi4uIWFjdGlvbi5tYW51YWwgJiYge1xuICAgICAgICAgICAgICBmZXRjaFN0YXR1czogXCJpZGxlXCIsXG4gICAgICAgICAgICAgIGZldGNoRmFpbHVyZUNvdW50OiAwLFxuICAgICAgICAgICAgICBmZXRjaEZhaWx1cmVSZWFzb246IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIHRoaXMuI3JldmVydFN0YXRlID0gYWN0aW9uLm1hbnVhbCA/IG5ld1N0YXRlIDogdm9pZCAwO1xuICAgICAgICAgIHJldHVybiBuZXdTdGF0ZTtcbiAgICAgICAgY2FzZSBcImVycm9yXCI6XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBhY3Rpb24uZXJyb3I7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnN0YXRlLFxuICAgICAgICAgICAgZXJyb3IsXG4gICAgICAgICAgICBlcnJvclVwZGF0ZUNvdW50OiBzdGF0ZS5lcnJvclVwZGF0ZUNvdW50ICsgMSxcbiAgICAgICAgICAgIGVycm9yVXBkYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgZmV0Y2hGYWlsdXJlQ291bnQ6IHN0YXRlLmZldGNoRmFpbHVyZUNvdW50ICsgMSxcbiAgICAgICAgICAgIGZldGNoRmFpbHVyZVJlYXNvbjogZXJyb3IsXG4gICAgICAgICAgICBmZXRjaFN0YXR1czogXCJpZGxlXCIsXG4gICAgICAgICAgICBzdGF0dXM6IFwiZXJyb3JcIlxuICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgXCJpbnZhbGlkYXRlXCI6XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnN0YXRlLFxuICAgICAgICAgICAgaXNJbnZhbGlkYXRlZDogdHJ1ZVxuICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgXCJzZXRTdGF0ZVwiOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICAgIC4uLmFjdGlvbi5zdGF0ZVxuICAgICAgICAgIH07XG4gICAgICB9XG4gICAgfTtcbiAgICB0aGlzLnN0YXRlID0gcmVkdWNlcih0aGlzLnN0YXRlKTtcbiAgICBub3RpZnlNYW5hZ2VyLmJhdGNoKCgpID0+IHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzLmZvckVhY2goKG9ic2VydmVyKSA9PiB7XG4gICAgICAgIG9ic2VydmVyLm9uUXVlcnlVcGRhdGUoKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy4jY2FjaGUubm90aWZ5KHsgcXVlcnk6IHRoaXMsIHR5cGU6IFwidXBkYXRlZFwiLCBhY3Rpb24gfSk7XG4gICAgfSk7XG4gIH1cbn07XG5mdW5jdGlvbiBmZXRjaFN0YXRlKGRhdGEsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIHtcbiAgICBmZXRjaEZhaWx1cmVDb3VudDogMCxcbiAgICBmZXRjaEZhaWx1cmVSZWFzb246IG51bGwsXG4gICAgZmV0Y2hTdGF0dXM6IGNhbkZldGNoKG9wdGlvbnMubmV0d29ya01vZGUpID8gXCJmZXRjaGluZ1wiIDogXCJwYXVzZWRcIixcbiAgICAuLi5kYXRhID09PSB2b2lkIDAgJiYge1xuICAgICAgZXJyb3I6IG51bGwsXG4gICAgICBzdGF0dXM6IFwicGVuZGluZ1wiXG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gc3VjY2Vzc1N0YXRlKGRhdGEsIGRhdGFVcGRhdGVkQXQpIHtcbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIGRhdGFVcGRhdGVkQXQ6IGRhdGFVcGRhdGVkQXQgPz8gRGF0ZS5ub3coKSxcbiAgICBlcnJvcjogbnVsbCxcbiAgICBpc0ludmFsaWRhdGVkOiBmYWxzZSxcbiAgICBzdGF0dXM6IFwic3VjY2Vzc1wiXG4gIH07XG59XG5mdW5jdGlvbiBnZXREZWZhdWx0U3RhdGUob3B0aW9ucykge1xuICBjb25zdCBkYXRhID0gdHlwZW9mIG9wdGlvbnMuaW5pdGlhbERhdGEgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuaW5pdGlhbERhdGEoKSA6IG9wdGlvbnMuaW5pdGlhbERhdGE7XG4gIGNvbnN0IGhhc0RhdGEgPSBkYXRhICE9PSB2b2lkIDA7XG4gIGNvbnN0IGluaXRpYWxEYXRhVXBkYXRlZEF0ID0gaGFzRGF0YSA/IHR5cGVvZiBvcHRpb25zLmluaXRpYWxEYXRhVXBkYXRlZEF0ID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmluaXRpYWxEYXRhVXBkYXRlZEF0KCkgOiBvcHRpb25zLmluaXRpYWxEYXRhVXBkYXRlZEF0IDogMDtcbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIGRhdGFVcGRhdGVDb3VudDogMCxcbiAgICBkYXRhVXBkYXRlZEF0OiBoYXNEYXRhID8gaW5pdGlhbERhdGFVcGRhdGVkQXQgPz8gRGF0ZS5ub3coKSA6IDAsXG4gICAgZXJyb3I6IG51bGwsXG4gICAgZXJyb3JVcGRhdGVDb3VudDogMCxcbiAgICBlcnJvclVwZGF0ZWRBdDogMCxcbiAgICBmZXRjaEZhaWx1cmVDb3VudDogMCxcbiAgICBmZXRjaEZhaWx1cmVSZWFzb246IG51bGwsXG4gICAgZmV0Y2hNZXRhOiBudWxsLFxuICAgIGlzSW52YWxpZGF0ZWQ6IGZhbHNlLFxuICAgIHN0YXR1czogaGFzRGF0YSA/IFwic3VjY2Vzc1wiIDogXCJwZW5kaW5nXCIsXG4gICAgZmV0Y2hTdGF0dXM6IFwiaWRsZVwiXG4gIH07XG59XG5leHBvcnQge1xuICBRdWVyeSxcbiAgZmV0Y2hTdGF0ZVxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXF1ZXJ5LmpzLm1hcCIsCiAgICAiLy8gc3JjL3F1ZXJ5Q2FjaGUudHNcbmltcG9ydCB7IGhhc2hRdWVyeUtleUJ5T3B0aW9ucywgbWF0Y2hRdWVyeSB9IGZyb20gXCIuL3V0aWxzLmpzXCI7XG5pbXBvcnQgeyBRdWVyeSB9IGZyb20gXCIuL3F1ZXJ5LmpzXCI7XG5pbXBvcnQgeyBub3RpZnlNYW5hZ2VyIH0gZnJvbSBcIi4vbm90aWZ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgU3Vic2NyaWJhYmxlIH0gZnJvbSBcIi4vc3Vic2NyaWJhYmxlLmpzXCI7XG52YXIgUXVlcnlDYWNoZSA9IGNsYXNzIGV4dGVuZHMgU3Vic2NyaWJhYmxlIHtcbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIHRoaXMuI3F1ZXJpZXMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICB9XG4gICNxdWVyaWVzO1xuICBidWlsZChjbGllbnQsIG9wdGlvbnMsIHN0YXRlKSB7XG4gICAgY29uc3QgcXVlcnlLZXkgPSBvcHRpb25zLnF1ZXJ5S2V5O1xuICAgIGNvbnN0IHF1ZXJ5SGFzaCA9IG9wdGlvbnMucXVlcnlIYXNoID8/IGhhc2hRdWVyeUtleUJ5T3B0aW9ucyhxdWVyeUtleSwgb3B0aW9ucyk7XG4gICAgbGV0IHF1ZXJ5ID0gdGhpcy5nZXQocXVlcnlIYXNoKTtcbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICBxdWVyeSA9IG5ldyBRdWVyeSh7XG4gICAgICAgIGNsaWVudCxcbiAgICAgICAgcXVlcnlLZXksXG4gICAgICAgIHF1ZXJ5SGFzaCxcbiAgICAgICAgb3B0aW9uczogY2xpZW50LmRlZmF1bHRRdWVyeU9wdGlvbnMob3B0aW9ucyksXG4gICAgICAgIHN0YXRlLFxuICAgICAgICBkZWZhdWx0T3B0aW9uczogY2xpZW50LmdldFF1ZXJ5RGVmYXVsdHMocXVlcnlLZXkpXG4gICAgICB9KTtcbiAgICAgIHRoaXMuYWRkKHF1ZXJ5KTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG4gIGFkZChxdWVyeSkge1xuICAgIGlmICghdGhpcy4jcXVlcmllcy5oYXMocXVlcnkucXVlcnlIYXNoKSkge1xuICAgICAgdGhpcy4jcXVlcmllcy5zZXQocXVlcnkucXVlcnlIYXNoLCBxdWVyeSk7XG4gICAgICB0aGlzLm5vdGlmeSh7XG4gICAgICAgIHR5cGU6IFwiYWRkZWRcIixcbiAgICAgICAgcXVlcnlcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICByZW1vdmUocXVlcnkpIHtcbiAgICBjb25zdCBxdWVyeUluTWFwID0gdGhpcy4jcXVlcmllcy5nZXQocXVlcnkucXVlcnlIYXNoKTtcbiAgICBpZiAocXVlcnlJbk1hcCkge1xuICAgICAgcXVlcnkuZGVzdHJveSgpO1xuICAgICAgaWYgKHF1ZXJ5SW5NYXAgPT09IHF1ZXJ5KSB7XG4gICAgICAgIHRoaXMuI3F1ZXJpZXMuZGVsZXRlKHF1ZXJ5LnF1ZXJ5SGFzaCk7XG4gICAgICB9XG4gICAgICB0aGlzLm5vdGlmeSh7IHR5cGU6IFwicmVtb3ZlZFwiLCBxdWVyeSB9KTtcbiAgICB9XG4gIH1cbiAgY2xlYXIoKSB7XG4gICAgbm90aWZ5TWFuYWdlci5iYXRjaCgoKSA9PiB7XG4gICAgICB0aGlzLmdldEFsbCgpLmZvckVhY2goKHF1ZXJ5KSA9PiB7XG4gICAgICAgIHRoaXMucmVtb3ZlKHF1ZXJ5KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIGdldChxdWVyeUhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy4jcXVlcmllcy5nZXQocXVlcnlIYXNoKTtcbiAgfVxuICBnZXRBbGwoKSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLiNxdWVyaWVzLnZhbHVlcygpXTtcbiAgfVxuICBmaW5kKGZpbHRlcnMpIHtcbiAgICBjb25zdCBkZWZhdWx0ZWRGaWx0ZXJzID0geyBleGFjdDogdHJ1ZSwgLi4uZmlsdGVycyB9O1xuICAgIHJldHVybiB0aGlzLmdldEFsbCgpLmZpbmQoXG4gICAgICAocXVlcnkpID0+IG1hdGNoUXVlcnkoZGVmYXVsdGVkRmlsdGVycywgcXVlcnkpXG4gICAgKTtcbiAgfVxuICBmaW5kQWxsKGZpbHRlcnMgPSB7fSkge1xuICAgIGNvbnN0IHF1ZXJpZXMgPSB0aGlzLmdldEFsbCgpO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhmaWx0ZXJzKS5sZW5ndGggPiAwID8gcXVlcmllcy5maWx0ZXIoKHF1ZXJ5KSA9PiBtYXRjaFF1ZXJ5KGZpbHRlcnMsIHF1ZXJ5KSkgOiBxdWVyaWVzO1xuICB9XG4gIG5vdGlmeShldmVudCkge1xuICAgIG5vdGlmeU1hbmFnZXIuYmF0Y2goKCkgPT4ge1xuICAgICAgdGhpcy5saXN0ZW5lcnMuZm9yRWFjaCgobGlzdGVuZXIpID0+IHtcbiAgICAgICAgbGlzdGVuZXIoZXZlbnQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgb25Gb2N1cygpIHtcbiAgICBub3RpZnlNYW5hZ2VyLmJhdGNoKCgpID0+IHtcbiAgICAgIHRoaXMuZ2V0QWxsKCkuZm9yRWFjaCgocXVlcnkpID0+IHtcbiAgICAgICAgcXVlcnkub25Gb2N1cygpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgb25PbmxpbmUoKSB7XG4gICAgbm90aWZ5TWFuYWdlci5iYXRjaCgoKSA9PiB7XG4gICAgICB0aGlzLmdldEFsbCgpLmZvckVhY2goKHF1ZXJ5KSA9PiB7XG4gICAgICAgIHF1ZXJ5Lm9uT25saW5lKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufTtcbmV4cG9ydCB7XG4gIFF1ZXJ5Q2FjaGVcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1xdWVyeUNhY2hlLmpzLm1hcCIsCiAgICAiLy8gc3JjL211dGF0aW9uLnRzXG5pbXBvcnQgeyBub3RpZnlNYW5hZ2VyIH0gZnJvbSBcIi4vbm90aWZ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgUmVtb3ZhYmxlIH0gZnJvbSBcIi4vcmVtb3ZhYmxlLmpzXCI7XG5pbXBvcnQgeyBjcmVhdGVSZXRyeWVyIH0gZnJvbSBcIi4vcmV0cnllci5qc1wiO1xudmFyIE11dGF0aW9uID0gY2xhc3MgZXh0ZW5kcyBSZW1vdmFibGUge1xuICAjY2xpZW50O1xuICAjb2JzZXJ2ZXJzO1xuICAjbXV0YXRpb25DYWNoZTtcbiAgI3JldHJ5ZXI7XG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy4jY2xpZW50ID0gY29uZmlnLmNsaWVudDtcbiAgICB0aGlzLm11dGF0aW9uSWQgPSBjb25maWcubXV0YXRpb25JZDtcbiAgICB0aGlzLiNtdXRhdGlvbkNhY2hlID0gY29uZmlnLm11dGF0aW9uQ2FjaGU7XG4gICAgdGhpcy4jb2JzZXJ2ZXJzID0gW107XG4gICAgdGhpcy5zdGF0ZSA9IGNvbmZpZy5zdGF0ZSB8fCBnZXREZWZhdWx0U3RhdGUoKTtcbiAgICB0aGlzLnNldE9wdGlvbnMoY29uZmlnLm9wdGlvbnMpO1xuICAgIHRoaXMuc2NoZWR1bGVHYygpO1xuICB9XG4gIHNldE9wdGlvbnMob3B0aW9ucykge1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy51cGRhdGVHY1RpbWUodGhpcy5vcHRpb25zLmdjVGltZSk7XG4gIH1cbiAgZ2V0IG1ldGEoKSB7XG4gICAgcmV0dXJuIHRoaXMub3B0aW9ucy5tZXRhO1xuICB9XG4gIGFkZE9ic2VydmVyKG9ic2VydmVyKSB7XG4gICAgaWYgKCF0aGlzLiNvYnNlcnZlcnMuaW5jbHVkZXMob2JzZXJ2ZXIpKSB7XG4gICAgICB0aGlzLiNvYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgICB0aGlzLmNsZWFyR2NUaW1lb3V0KCk7XG4gICAgICB0aGlzLiNtdXRhdGlvbkNhY2hlLm5vdGlmeSh7XG4gICAgICAgIHR5cGU6IFwib2JzZXJ2ZXJBZGRlZFwiLFxuICAgICAgICBtdXRhdGlvbjogdGhpcyxcbiAgICAgICAgb2JzZXJ2ZXJcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICByZW1vdmVPYnNlcnZlcihvYnNlcnZlcikge1xuICAgIHRoaXMuI29ic2VydmVycyA9IHRoaXMuI29ic2VydmVycy5maWx0ZXIoKHgpID0+IHggIT09IG9ic2VydmVyKTtcbiAgICB0aGlzLnNjaGVkdWxlR2MoKTtcbiAgICB0aGlzLiNtdXRhdGlvbkNhY2hlLm5vdGlmeSh7XG4gICAgICB0eXBlOiBcIm9ic2VydmVyUmVtb3ZlZFwiLFxuICAgICAgbXV0YXRpb246IHRoaXMsXG4gICAgICBvYnNlcnZlclxuICAgIH0pO1xuICB9XG4gIG9wdGlvbmFsUmVtb3ZlKCkge1xuICAgIGlmICghdGhpcy4jb2JzZXJ2ZXJzLmxlbmd0aCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzID09PSBcInBlbmRpbmdcIikge1xuICAgICAgICB0aGlzLnNjaGVkdWxlR2MoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuI211dGF0aW9uQ2FjaGUucmVtb3ZlKHRoaXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb250aW51ZSgpIHtcbiAgICByZXR1cm4gdGhpcy4jcmV0cnllcj8uY29udGludWUoKSA/PyAvLyBjb250aW51aW5nIGEgbXV0YXRpb24gYXNzdW1lcyB0aGF0IHZhcmlhYmxlcyBhcmUgc2V0LCBtdXRhdGlvbiBtdXN0IGhhdmUgYmVlbiBkZWh5ZHJhdGVkIGJlZm9yZVxuICAgIHRoaXMuZXhlY3V0ZSh0aGlzLnN0YXRlLnZhcmlhYmxlcyk7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZSh2YXJpYWJsZXMpIHtcbiAgICBjb25zdCBvbkNvbnRpbnVlID0gKCkgPT4ge1xuICAgICAgdGhpcy4jZGlzcGF0Y2goeyB0eXBlOiBcImNvbnRpbnVlXCIgfSk7XG4gICAgfTtcbiAgICBjb25zdCBtdXRhdGlvbkZuQ29udGV4dCA9IHtcbiAgICAgIGNsaWVudDogdGhpcy4jY2xpZW50LFxuICAgICAgbWV0YTogdGhpcy5vcHRpb25zLm1ldGEsXG4gICAgICBtdXRhdGlvbktleTogdGhpcy5vcHRpb25zLm11dGF0aW9uS2V5XG4gICAgfTtcbiAgICB0aGlzLiNyZXRyeWVyID0gY3JlYXRlUmV0cnllcih7XG4gICAgICBmbjogKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5tdXRhdGlvbkZuKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihcIk5vIG11dGF0aW9uRm4gZm91bmRcIikpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMubXV0YXRpb25Gbih2YXJpYWJsZXMsIG11dGF0aW9uRm5Db250ZXh0KTtcbiAgICAgIH0sXG4gICAgICBvbkZhaWw6IChmYWlsdXJlQ291bnQsIGVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMuI2Rpc3BhdGNoKHsgdHlwZTogXCJmYWlsZWRcIiwgZmFpbHVyZUNvdW50LCBlcnJvciB9KTtcbiAgICAgIH0sXG4gICAgICBvblBhdXNlOiAoKSA9PiB7XG4gICAgICAgIHRoaXMuI2Rpc3BhdGNoKHsgdHlwZTogXCJwYXVzZVwiIH0pO1xuICAgICAgfSxcbiAgICAgIG9uQ29udGludWUsXG4gICAgICByZXRyeTogdGhpcy5vcHRpb25zLnJldHJ5ID8/IDAsXG4gICAgICByZXRyeURlbGF5OiB0aGlzLm9wdGlvbnMucmV0cnlEZWxheSxcbiAgICAgIG5ldHdvcmtNb2RlOiB0aGlzLm9wdGlvbnMubmV0d29ya01vZGUsXG4gICAgICBjYW5SdW46ICgpID0+IHRoaXMuI211dGF0aW9uQ2FjaGUuY2FuUnVuKHRoaXMpXG4gICAgfSk7XG4gICAgY29uc3QgcmVzdG9yZWQgPSB0aGlzLnN0YXRlLnN0YXR1cyA9PT0gXCJwZW5kaW5nXCI7XG4gICAgY29uc3QgaXNQYXVzZWQgPSAhdGhpcy4jcmV0cnllci5jYW5TdGFydCgpO1xuICAgIHRyeSB7XG4gICAgICBpZiAocmVzdG9yZWQpIHtcbiAgICAgICAgb25Db250aW51ZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy4jZGlzcGF0Y2goeyB0eXBlOiBcInBlbmRpbmdcIiwgdmFyaWFibGVzLCBpc1BhdXNlZCB9KTtcbiAgICAgICAgYXdhaXQgdGhpcy4jbXV0YXRpb25DYWNoZS5jb25maWcub25NdXRhdGU/LihcbiAgICAgICAgICB2YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICBtdXRhdGlvbkZuQ29udGV4dFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5vcHRpb25zLm9uTXV0YXRlPy4oXG4gICAgICAgICAgdmFyaWFibGVzLFxuICAgICAgICAgIG11dGF0aW9uRm5Db250ZXh0XG4gICAgICAgICk7XG4gICAgICAgIGlmIChjb250ZXh0ICE9PSB0aGlzLnN0YXRlLmNvbnRleHQpIHtcbiAgICAgICAgICB0aGlzLiNkaXNwYXRjaCh7XG4gICAgICAgICAgICB0eXBlOiBcInBlbmRpbmdcIixcbiAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICB2YXJpYWJsZXMsXG4gICAgICAgICAgICBpc1BhdXNlZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy4jcmV0cnllci5zdGFydCgpO1xuICAgICAgYXdhaXQgdGhpcy4jbXV0YXRpb25DYWNoZS5jb25maWcub25TdWNjZXNzPy4oXG4gICAgICAgIGRhdGEsXG4gICAgICAgIHZhcmlhYmxlcyxcbiAgICAgICAgdGhpcy5zdGF0ZS5jb250ZXh0LFxuICAgICAgICB0aGlzLFxuICAgICAgICBtdXRhdGlvbkZuQ29udGV4dFxuICAgICAgKTtcbiAgICAgIGF3YWl0IHRoaXMub3B0aW9ucy5vblN1Y2Nlc3M/LihcbiAgICAgICAgZGF0YSxcbiAgICAgICAgdmFyaWFibGVzLFxuICAgICAgICB0aGlzLnN0YXRlLmNvbnRleHQsXG4gICAgICAgIG11dGF0aW9uRm5Db250ZXh0XG4gICAgICApO1xuICAgICAgYXdhaXQgdGhpcy4jbXV0YXRpb25DYWNoZS5jb25maWcub25TZXR0bGVkPy4oXG4gICAgICAgIGRhdGEsXG4gICAgICAgIG51bGwsXG4gICAgICAgIHRoaXMuc3RhdGUudmFyaWFibGVzLFxuICAgICAgICB0aGlzLnN0YXRlLmNvbnRleHQsXG4gICAgICAgIHRoaXMsXG4gICAgICAgIG11dGF0aW9uRm5Db250ZXh0XG4gICAgICApO1xuICAgICAgYXdhaXQgdGhpcy5vcHRpb25zLm9uU2V0dGxlZD8uKFxuICAgICAgICBkYXRhLFxuICAgICAgICBudWxsLFxuICAgICAgICB2YXJpYWJsZXMsXG4gICAgICAgIHRoaXMuc3RhdGUuY29udGV4dCxcbiAgICAgICAgbXV0YXRpb25GbkNvbnRleHRcbiAgICAgICk7XG4gICAgICB0aGlzLiNkaXNwYXRjaCh7IHR5cGU6IFwic3VjY2Vzc1wiLCBkYXRhIH0pO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMuI211dGF0aW9uQ2FjaGUuY29uZmlnLm9uRXJyb3I/LihcbiAgICAgICAgICBlcnJvcixcbiAgICAgICAgICB2YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5zdGF0ZS5jb250ZXh0LFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgbXV0YXRpb25GbkNvbnRleHRcbiAgICAgICAgKTtcbiAgICAgICAgYXdhaXQgdGhpcy5vcHRpb25zLm9uRXJyb3I/LihcbiAgICAgICAgICBlcnJvcixcbiAgICAgICAgICB2YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5zdGF0ZS5jb250ZXh0LFxuICAgICAgICAgIG11dGF0aW9uRm5Db250ZXh0XG4gICAgICAgICk7XG4gICAgICAgIGF3YWl0IHRoaXMuI211dGF0aW9uQ2FjaGUuY29uZmlnLm9uU2V0dGxlZD8uKFxuICAgICAgICAgIHZvaWQgMCxcbiAgICAgICAgICBlcnJvcixcbiAgICAgICAgICB0aGlzLnN0YXRlLnZhcmlhYmxlcyxcbiAgICAgICAgICB0aGlzLnN0YXRlLmNvbnRleHQsXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICBtdXRhdGlvbkZuQ29udGV4dFxuICAgICAgICApO1xuICAgICAgICBhd2FpdCB0aGlzLm9wdGlvbnMub25TZXR0bGVkPy4oXG4gICAgICAgICAgdm9pZCAwLFxuICAgICAgICAgIGVycm9yLFxuICAgICAgICAgIHZhcmlhYmxlcyxcbiAgICAgICAgICB0aGlzLnN0YXRlLmNvbnRleHQsXG4gICAgICAgICAgbXV0YXRpb25GbkNvbnRleHRcbiAgICAgICAgKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0aGlzLiNkaXNwYXRjaCh7IHR5cGU6IFwiZXJyb3JcIiwgZXJyb3IgfSk7XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuI211dGF0aW9uQ2FjaGUucnVuTmV4dCh0aGlzKTtcbiAgICB9XG4gIH1cbiAgI2Rpc3BhdGNoKGFjdGlvbikge1xuICAgIGNvbnN0IHJlZHVjZXIgPSAoc3RhdGUpID0+IHtcbiAgICAgIHN3aXRjaCAoYWN0aW9uLnR5cGUpIHtcbiAgICAgICAgY2FzZSBcImZhaWxlZFwiOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudDogYWN0aW9uLmZhaWx1cmVDb3VudCxcbiAgICAgICAgICAgIGZhaWx1cmVSZWFzb246IGFjdGlvbi5lcnJvclxuICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgXCJwYXVzZVwiOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICAgIGlzUGF1c2VkOiB0cnVlXG4gICAgICAgICAgfTtcbiAgICAgICAgY2FzZSBcImNvbnRpbnVlXCI6XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnN0YXRlLFxuICAgICAgICAgICAgaXNQYXVzZWQ6IGZhbHNlXG4gICAgICAgICAgfTtcbiAgICAgICAgY2FzZSBcInBlbmRpbmdcIjpcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uc3RhdGUsXG4gICAgICAgICAgICBjb250ZXh0OiBhY3Rpb24uY29udGV4dCxcbiAgICAgICAgICAgIGRhdGE6IHZvaWQgMCxcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudDogMCxcbiAgICAgICAgICAgIGZhaWx1cmVSZWFzb246IG51bGwsXG4gICAgICAgICAgICBlcnJvcjogbnVsbCxcbiAgICAgICAgICAgIGlzUGF1c2VkOiBhY3Rpb24uaXNQYXVzZWQsXG4gICAgICAgICAgICBzdGF0dXM6IFwicGVuZGluZ1wiLFxuICAgICAgICAgICAgdmFyaWFibGVzOiBhY3Rpb24udmFyaWFibGVzLFxuICAgICAgICAgICAgc3VibWl0dGVkQXQ6IERhdGUubm93KClcbiAgICAgICAgICB9O1xuICAgICAgICBjYXNlIFwic3VjY2Vzc1wiOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICAgIGRhdGE6IGFjdGlvbi5kYXRhLFxuICAgICAgICAgICAgZmFpbHVyZUNvdW50OiAwLFxuICAgICAgICAgICAgZmFpbHVyZVJlYXNvbjogbnVsbCxcbiAgICAgICAgICAgIGVycm9yOiBudWxsLFxuICAgICAgICAgICAgc3RhdHVzOiBcInN1Y2Nlc3NcIixcbiAgICAgICAgICAgIGlzUGF1c2VkOiBmYWxzZVxuICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgXCJlcnJvclwiOlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICAgIGRhdGE6IHZvaWQgMCxcbiAgICAgICAgICAgIGVycm9yOiBhY3Rpb24uZXJyb3IsXG4gICAgICAgICAgICBmYWlsdXJlQ291bnQ6IHN0YXRlLmZhaWx1cmVDb3VudCArIDEsXG4gICAgICAgICAgICBmYWlsdXJlUmVhc29uOiBhY3Rpb24uZXJyb3IsXG4gICAgICAgICAgICBpc1BhdXNlZDogZmFsc2UsXG4gICAgICAgICAgICBzdGF0dXM6IFwiZXJyb3JcIlxuICAgICAgICAgIH07XG4gICAgICB9XG4gICAgfTtcbiAgICB0aGlzLnN0YXRlID0gcmVkdWNlcih0aGlzLnN0YXRlKTtcbiAgICBub3RpZnlNYW5hZ2VyLmJhdGNoKCgpID0+IHtcbiAgICAgIHRoaXMuI29ic2VydmVycy5mb3JFYWNoKChvYnNlcnZlcikgPT4ge1xuICAgICAgICBvYnNlcnZlci5vbk11dGF0aW9uVXBkYXRlKGFjdGlvbik7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuI211dGF0aW9uQ2FjaGUubm90aWZ5KHtcbiAgICAgICAgbXV0YXRpb246IHRoaXMsXG4gICAgICAgIHR5cGU6IFwidXBkYXRlZFwiLFxuICAgICAgICBhY3Rpb25cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59O1xuZnVuY3Rpb24gZ2V0RGVmYXVsdFN0YXRlKCkge1xuICByZXR1cm4ge1xuICAgIGNvbnRleHQ6IHZvaWQgMCxcbiAgICBkYXRhOiB2b2lkIDAsXG4gICAgZXJyb3I6IG51bGwsXG4gICAgZmFpbHVyZUNvdW50OiAwLFxuICAgIGZhaWx1cmVSZWFzb246IG51bGwsXG4gICAgaXNQYXVzZWQ6IGZhbHNlLFxuICAgIHN0YXR1czogXCJpZGxlXCIsXG4gICAgdmFyaWFibGVzOiB2b2lkIDAsXG4gICAgc3VibWl0dGVkQXQ6IDBcbiAgfTtcbn1cbmV4cG9ydCB7XG4gIE11dGF0aW9uLFxuICBnZXREZWZhdWx0U3RhdGVcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1tdXRhdGlvbi5qcy5tYXAiLAogICAgIi8vIHNyYy9tdXRhdGlvbkNhY2hlLnRzXG5pbXBvcnQgeyBub3RpZnlNYW5hZ2VyIH0gZnJvbSBcIi4vbm90aWZ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgTXV0YXRpb24gfSBmcm9tIFwiLi9tdXRhdGlvbi5qc1wiO1xuaW1wb3J0IHsgbWF0Y2hNdXRhdGlvbiwgbm9vcCB9IGZyb20gXCIuL3V0aWxzLmpzXCI7XG5pbXBvcnQgeyBTdWJzY3JpYmFibGUgfSBmcm9tIFwiLi9zdWJzY3JpYmFibGUuanNcIjtcbnZhciBNdXRhdGlvbkNhY2hlID0gY2xhc3MgZXh0ZW5kcyBTdWJzY3JpYmFibGUge1xuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgdGhpcy4jbXV0YXRpb25zID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgICB0aGlzLiNzY29wZXMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICAgIHRoaXMuI211dGF0aW9uSWQgPSAwO1xuICB9XG4gICNtdXRhdGlvbnM7XG4gICNzY29wZXM7XG4gICNtdXRhdGlvbklkO1xuICBidWlsZChjbGllbnQsIG9wdGlvbnMsIHN0YXRlKSB7XG4gICAgY29uc3QgbXV0YXRpb24gPSBuZXcgTXV0YXRpb24oe1xuICAgICAgY2xpZW50LFxuICAgICAgbXV0YXRpb25DYWNoZTogdGhpcyxcbiAgICAgIG11dGF0aW9uSWQ6ICsrdGhpcy4jbXV0YXRpb25JZCxcbiAgICAgIG9wdGlvbnM6IGNsaWVudC5kZWZhdWx0TXV0YXRpb25PcHRpb25zKG9wdGlvbnMpLFxuICAgICAgc3RhdGVcbiAgICB9KTtcbiAgICB0aGlzLmFkZChtdXRhdGlvbik7XG4gICAgcmV0dXJuIG11dGF0aW9uO1xuICB9XG4gIGFkZChtdXRhdGlvbikge1xuICAgIHRoaXMuI211dGF0aW9ucy5hZGQobXV0YXRpb24pO1xuICAgIGNvbnN0IHNjb3BlID0gc2NvcGVGb3IobXV0YXRpb24pO1xuICAgIGlmICh0eXBlb2Ygc2NvcGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGNvbnN0IHNjb3BlZE11dGF0aW9ucyA9IHRoaXMuI3Njb3Blcy5nZXQoc2NvcGUpO1xuICAgICAgaWYgKHNjb3BlZE11dGF0aW9ucykge1xuICAgICAgICBzY29wZWRNdXRhdGlvbnMucHVzaChtdXRhdGlvbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLiNzY29wZXMuc2V0KHNjb3BlLCBbbXV0YXRpb25dKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5ub3RpZnkoeyB0eXBlOiBcImFkZGVkXCIsIG11dGF0aW9uIH0pO1xuICB9XG4gIHJlbW92ZShtdXRhdGlvbikge1xuICAgIGlmICh0aGlzLiNtdXRhdGlvbnMuZGVsZXRlKG11dGF0aW9uKSkge1xuICAgICAgY29uc3Qgc2NvcGUgPSBzY29wZUZvcihtdXRhdGlvbik7XG4gICAgICBpZiAodHlwZW9mIHNjb3BlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGNvbnN0IHNjb3BlZE11dGF0aW9ucyA9IHRoaXMuI3Njb3Blcy5nZXQoc2NvcGUpO1xuICAgICAgICBpZiAoc2NvcGVkTXV0YXRpb25zKSB7XG4gICAgICAgICAgaWYgKHNjb3BlZE11dGF0aW9ucy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IHNjb3BlZE11dGF0aW9ucy5pbmRleE9mKG11dGF0aW9uKTtcbiAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgc2NvcGVkTXV0YXRpb25zLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChzY29wZWRNdXRhdGlvbnNbMF0gPT09IG11dGF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLiNzY29wZXMuZGVsZXRlKHNjb3BlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5ub3RpZnkoeyB0eXBlOiBcInJlbW92ZWRcIiwgbXV0YXRpb24gfSk7XG4gIH1cbiAgY2FuUnVuKG11dGF0aW9uKSB7XG4gICAgY29uc3Qgc2NvcGUgPSBzY29wZUZvcihtdXRhdGlvbik7XG4gICAgaWYgKHR5cGVvZiBzY29wZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgY29uc3QgbXV0YXRpb25zV2l0aFNhbWVTY29wZSA9IHRoaXMuI3Njb3Blcy5nZXQoc2NvcGUpO1xuICAgICAgY29uc3QgZmlyc3RQZW5kaW5nTXV0YXRpb24gPSBtdXRhdGlvbnNXaXRoU2FtZVNjb3BlPy5maW5kKFxuICAgICAgICAobSkgPT4gbS5zdGF0ZS5zdGF0dXMgPT09IFwicGVuZGluZ1wiXG4gICAgICApO1xuICAgICAgcmV0dXJuICFmaXJzdFBlbmRpbmdNdXRhdGlvbiB8fCBmaXJzdFBlbmRpbmdNdXRhdGlvbiA9PT0gbXV0YXRpb247XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICBydW5OZXh0KG11dGF0aW9uKSB7XG4gICAgY29uc3Qgc2NvcGUgPSBzY29wZUZvcihtdXRhdGlvbik7XG4gICAgaWYgKHR5cGVvZiBzY29wZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgY29uc3QgZm91bmRNdXRhdGlvbiA9IHRoaXMuI3Njb3Blcy5nZXQoc2NvcGUpPy5maW5kKChtKSA9PiBtICE9PSBtdXRhdGlvbiAmJiBtLnN0YXRlLmlzUGF1c2VkKTtcbiAgICAgIHJldHVybiBmb3VuZE11dGF0aW9uPy5jb250aW51ZSgpID8/IFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuICB9XG4gIGNsZWFyKCkge1xuICAgIG5vdGlmeU1hbmFnZXIuYmF0Y2goKCkgPT4ge1xuICAgICAgdGhpcy4jbXV0YXRpb25zLmZvckVhY2goKG11dGF0aW9uKSA9PiB7XG4gICAgICAgIHRoaXMubm90aWZ5KHsgdHlwZTogXCJyZW1vdmVkXCIsIG11dGF0aW9uIH0pO1xuICAgICAgfSk7XG4gICAgICB0aGlzLiNtdXRhdGlvbnMuY2xlYXIoKTtcbiAgICAgIHRoaXMuI3Njb3Blcy5jbGVhcigpO1xuICAgIH0pO1xuICB9XG4gIGdldEFsbCgpIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLiNtdXRhdGlvbnMpO1xuICB9XG4gIGZpbmQoZmlsdGVycykge1xuICAgIGNvbnN0IGRlZmF1bHRlZEZpbHRlcnMgPSB7IGV4YWN0OiB0cnVlLCAuLi5maWx0ZXJzIH07XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsKCkuZmluZChcbiAgICAgIChtdXRhdGlvbikgPT4gbWF0Y2hNdXRhdGlvbihkZWZhdWx0ZWRGaWx0ZXJzLCBtdXRhdGlvbilcbiAgICApO1xuICB9XG4gIGZpbmRBbGwoZmlsdGVycyA9IHt9KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsKCkuZmlsdGVyKChtdXRhdGlvbikgPT4gbWF0Y2hNdXRhdGlvbihmaWx0ZXJzLCBtdXRhdGlvbikpO1xuICB9XG4gIG5vdGlmeShldmVudCkge1xuICAgIG5vdGlmeU1hbmFnZXIuYmF0Y2goKCkgPT4ge1xuICAgICAgdGhpcy5saXN0ZW5lcnMuZm9yRWFjaCgobGlzdGVuZXIpID0+IHtcbiAgICAgICAgbGlzdGVuZXIoZXZlbnQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgcmVzdW1lUGF1c2VkTXV0YXRpb25zKCkge1xuICAgIGNvbnN0IHBhdXNlZE11dGF0aW9ucyA9IHRoaXMuZ2V0QWxsKCkuZmlsdGVyKCh4KSA9PiB4LnN0YXRlLmlzUGF1c2VkKTtcbiAgICByZXR1cm4gbm90aWZ5TWFuYWdlci5iYXRjaChcbiAgICAgICgpID0+IFByb21pc2UuYWxsKFxuICAgICAgICBwYXVzZWRNdXRhdGlvbnMubWFwKChtdXRhdGlvbikgPT4gbXV0YXRpb24uY29udGludWUoKS5jYXRjaChub29wKSlcbiAgICAgIClcbiAgICApO1xuICB9XG59O1xuZnVuY3Rpb24gc2NvcGVGb3IobXV0YXRpb24pIHtcbiAgcmV0dXJuIG11dGF0aW9uLm9wdGlvbnMuc2NvcGU/LmlkO1xufVxuZXhwb3J0IHtcbiAgTXV0YXRpb25DYWNoZVxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW11dGF0aW9uQ2FjaGUuanMubWFwIiwKICAgICIvLyBzcmMvaW5maW5pdGVRdWVyeUJlaGF2aW9yLnRzXG5pbXBvcnQgeyBhZGRUb0VuZCwgYWRkVG9TdGFydCwgZW5zdXJlUXVlcnlGbiB9IGZyb20gXCIuL3V0aWxzLmpzXCI7XG5mdW5jdGlvbiBpbmZpbml0ZVF1ZXJ5QmVoYXZpb3IocGFnZXMpIHtcbiAgcmV0dXJuIHtcbiAgICBvbkZldGNoOiAoY29udGV4dCwgcXVlcnkpID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSBjb250ZXh0Lm9wdGlvbnM7XG4gICAgICBjb25zdCBkaXJlY3Rpb24gPSBjb250ZXh0LmZldGNoT3B0aW9ucz8ubWV0YT8uZmV0Y2hNb3JlPy5kaXJlY3Rpb247XG4gICAgICBjb25zdCBvbGRQYWdlcyA9IGNvbnRleHQuc3RhdGUuZGF0YT8ucGFnZXMgfHwgW107XG4gICAgICBjb25zdCBvbGRQYWdlUGFyYW1zID0gY29udGV4dC5zdGF0ZS5kYXRhPy5wYWdlUGFyYW1zIHx8IFtdO1xuICAgICAgbGV0IHJlc3VsdCA9IHsgcGFnZXM6IFtdLCBwYWdlUGFyYW1zOiBbXSB9O1xuICAgICAgbGV0IGN1cnJlbnRQYWdlID0gMDtcbiAgICAgIGNvbnN0IGZldGNoRm4gPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgYWRkU2lnbmFsUHJvcGVydHkgPSAob2JqZWN0KSA9PiB7XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdCwgXCJzaWduYWxcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGdldDogKCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoY29udGV4dC5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgICAgICAgICAgIGNhbmNlbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNhbmNlbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQuc2lnbmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBxdWVyeUZuID0gZW5zdXJlUXVlcnlGbihjb250ZXh0Lm9wdGlvbnMsIGNvbnRleHQuZmV0Y2hPcHRpb25zKTtcbiAgICAgICAgY29uc3QgZmV0Y2hQYWdlID0gYXN5bmMgKGRhdGEsIHBhcmFtLCBwcmV2aW91cykgPT4ge1xuICAgICAgICAgIGlmIChjYW5jZWxsZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocGFyYW0gPT0gbnVsbCAmJiBkYXRhLnBhZ2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgY3JlYXRlUXVlcnlGbkNvbnRleHQgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBxdWVyeUZuQ29udGV4dDIgPSB7XG4gICAgICAgICAgICAgIGNsaWVudDogY29udGV4dC5jbGllbnQsXG4gICAgICAgICAgICAgIHF1ZXJ5S2V5OiBjb250ZXh0LnF1ZXJ5S2V5LFxuICAgICAgICAgICAgICBwYWdlUGFyYW06IHBhcmFtLFxuICAgICAgICAgICAgICBkaXJlY3Rpb246IHByZXZpb3VzID8gXCJiYWNrd2FyZFwiIDogXCJmb3J3YXJkXCIsXG4gICAgICAgICAgICAgIG1ldGE6IGNvbnRleHQub3B0aW9ucy5tZXRhXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYWRkU2lnbmFsUHJvcGVydHkocXVlcnlGbkNvbnRleHQyKTtcbiAgICAgICAgICAgIHJldHVybiBxdWVyeUZuQ29udGV4dDI7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCBxdWVyeUZuQ29udGV4dCA9IGNyZWF0ZVF1ZXJ5Rm5Db250ZXh0KCk7XG4gICAgICAgICAgY29uc3QgcGFnZSA9IGF3YWl0IHF1ZXJ5Rm4ocXVlcnlGbkNvbnRleHQpO1xuICAgICAgICAgIGNvbnN0IHsgbWF4UGFnZXMgfSA9IGNvbnRleHQub3B0aW9ucztcbiAgICAgICAgICBjb25zdCBhZGRUbyA9IHByZXZpb3VzID8gYWRkVG9TdGFydCA6IGFkZFRvRW5kO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYWdlczogYWRkVG8oZGF0YS5wYWdlcywgcGFnZSwgbWF4UGFnZXMpLFxuICAgICAgICAgICAgcGFnZVBhcmFtczogYWRkVG8oZGF0YS5wYWdlUGFyYW1zLCBwYXJhbSwgbWF4UGFnZXMpXG4gICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGRpcmVjdGlvbiAmJiBvbGRQYWdlcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zdCBwcmV2aW91cyA9IGRpcmVjdGlvbiA9PT0gXCJiYWNrd2FyZFwiO1xuICAgICAgICAgIGNvbnN0IHBhZ2VQYXJhbUZuID0gcHJldmlvdXMgPyBnZXRQcmV2aW91c1BhZ2VQYXJhbSA6IGdldE5leHRQYWdlUGFyYW07XG4gICAgICAgICAgY29uc3Qgb2xkRGF0YSA9IHtcbiAgICAgICAgICAgIHBhZ2VzOiBvbGRQYWdlcyxcbiAgICAgICAgICAgIHBhZ2VQYXJhbXM6IG9sZFBhZ2VQYXJhbXNcbiAgICAgICAgICB9O1xuICAgICAgICAgIGNvbnN0IHBhcmFtID0gcGFnZVBhcmFtRm4ob3B0aW9ucywgb2xkRGF0YSk7XG4gICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZmV0Y2hQYWdlKG9sZERhdGEsIHBhcmFtLCBwcmV2aW91cyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcmVtYWluaW5nUGFnZXMgPSBwYWdlcyA/PyBvbGRQYWdlcy5sZW5ndGg7XG4gICAgICAgICAgZG8ge1xuICAgICAgICAgICAgY29uc3QgcGFyYW0gPSBjdXJyZW50UGFnZSA9PT0gMCA/IG9sZFBhZ2VQYXJhbXNbMF0gPz8gb3B0aW9ucy5pbml0aWFsUGFnZVBhcmFtIDogZ2V0TmV4dFBhZ2VQYXJhbShvcHRpb25zLCByZXN1bHQpO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRQYWdlID4gMCAmJiBwYXJhbSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZmV0Y2hQYWdlKHJlc3VsdCwgcGFyYW0pO1xuICAgICAgICAgICAgY3VycmVudFBhZ2UrKztcbiAgICAgICAgICB9IHdoaWxlIChjdXJyZW50UGFnZSA8IHJlbWFpbmluZ1BhZ2VzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcbiAgICAgIGlmIChjb250ZXh0Lm9wdGlvbnMucGVyc2lzdGVyKSB7XG4gICAgICAgIGNvbnRleHQuZmV0Y2hGbiA9ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gY29udGV4dC5vcHRpb25zLnBlcnNpc3Rlcj8uKFxuICAgICAgICAgICAgZmV0Y2hGbixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2xpZW50OiBjb250ZXh0LmNsaWVudCxcbiAgICAgICAgICAgICAgcXVlcnlLZXk6IGNvbnRleHQucXVlcnlLZXksXG4gICAgICAgICAgICAgIG1ldGE6IGNvbnRleHQub3B0aW9ucy5tZXRhLFxuICAgICAgICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcXVlcnlcbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGV4dC5mZXRjaEZuID0gZmV0Y2hGbjtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBnZXROZXh0UGFnZVBhcmFtKG9wdGlvbnMsIHsgcGFnZXMsIHBhZ2VQYXJhbXMgfSkge1xuICBjb25zdCBsYXN0SW5kZXggPSBwYWdlcy5sZW5ndGggLSAxO1xuICByZXR1cm4gcGFnZXMubGVuZ3RoID4gMCA/IG9wdGlvbnMuZ2V0TmV4dFBhZ2VQYXJhbShcbiAgICBwYWdlc1tsYXN0SW5kZXhdLFxuICAgIHBhZ2VzLFxuICAgIHBhZ2VQYXJhbXNbbGFzdEluZGV4XSxcbiAgICBwYWdlUGFyYW1zXG4gICkgOiB2b2lkIDA7XG59XG5mdW5jdGlvbiBnZXRQcmV2aW91c1BhZ2VQYXJhbShvcHRpb25zLCB7IHBhZ2VzLCBwYWdlUGFyYW1zIH0pIHtcbiAgcmV0dXJuIHBhZ2VzLmxlbmd0aCA+IDAgPyBvcHRpb25zLmdldFByZXZpb3VzUGFnZVBhcmFtPy4ocGFnZXNbMF0sIHBhZ2VzLCBwYWdlUGFyYW1zWzBdLCBwYWdlUGFyYW1zKSA6IHZvaWQgMDtcbn1cbmZ1bmN0aW9uIGhhc05leHRQYWdlKG9wdGlvbnMsIGRhdGEpIHtcbiAgaWYgKCFkYXRhKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBnZXROZXh0UGFnZVBhcmFtKG9wdGlvbnMsIGRhdGEpICE9IG51bGw7XG59XG5mdW5jdGlvbiBoYXNQcmV2aW91c1BhZ2Uob3B0aW9ucywgZGF0YSkge1xuICBpZiAoIWRhdGEgfHwgIW9wdGlvbnMuZ2V0UHJldmlvdXNQYWdlUGFyYW0pIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIGdldFByZXZpb3VzUGFnZVBhcmFtKG9wdGlvbnMsIGRhdGEpICE9IG51bGw7XG59XG5leHBvcnQge1xuICBoYXNOZXh0UGFnZSxcbiAgaGFzUHJldmlvdXNQYWdlLFxuICBpbmZpbml0ZVF1ZXJ5QmVoYXZpb3Jcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmZpbml0ZVF1ZXJ5QmVoYXZpb3IuanMubWFwIiwKICAgICIvLyBzcmMvcXVlcnlDbGllbnQudHNcbmltcG9ydCB7XG4gIGZ1bmN0aW9uYWxVcGRhdGUsXG4gIGhhc2hLZXksXG4gIGhhc2hRdWVyeUtleUJ5T3B0aW9ucyxcbiAgbm9vcCxcbiAgcGFydGlhbE1hdGNoS2V5LFxuICByZXNvbHZlU3RhbGVUaW1lLFxuICBza2lwVG9rZW5cbn0gZnJvbSBcIi4vdXRpbHMuanNcIjtcbmltcG9ydCB7IFF1ZXJ5Q2FjaGUgfSBmcm9tIFwiLi9xdWVyeUNhY2hlLmpzXCI7XG5pbXBvcnQgeyBNdXRhdGlvbkNhY2hlIH0gZnJvbSBcIi4vbXV0YXRpb25DYWNoZS5qc1wiO1xuaW1wb3J0IHsgZm9jdXNNYW5hZ2VyIH0gZnJvbSBcIi4vZm9jdXNNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBvbmxpbmVNYW5hZ2VyIH0gZnJvbSBcIi4vb25saW5lTWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgbm90aWZ5TWFuYWdlciB9IGZyb20gXCIuL25vdGlmeU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IGluZmluaXRlUXVlcnlCZWhhdmlvciB9IGZyb20gXCIuL2luZmluaXRlUXVlcnlCZWhhdmlvci5qc1wiO1xudmFyIFF1ZXJ5Q2xpZW50ID0gY2xhc3Mge1xuICAjcXVlcnlDYWNoZTtcbiAgI211dGF0aW9uQ2FjaGU7XG4gICNkZWZhdWx0T3B0aW9ucztcbiAgI3F1ZXJ5RGVmYXVsdHM7XG4gICNtdXRhdGlvbkRlZmF1bHRzO1xuICAjbW91bnRDb3VudDtcbiAgI3Vuc3Vic2NyaWJlRm9jdXM7XG4gICN1bnN1YnNjcmliZU9ubGluZTtcbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICB0aGlzLiNxdWVyeUNhY2hlID0gY29uZmlnLnF1ZXJ5Q2FjaGUgfHwgbmV3IFF1ZXJ5Q2FjaGUoKTtcbiAgICB0aGlzLiNtdXRhdGlvbkNhY2hlID0gY29uZmlnLm11dGF0aW9uQ2FjaGUgfHwgbmV3IE11dGF0aW9uQ2FjaGUoKTtcbiAgICB0aGlzLiNkZWZhdWx0T3B0aW9ucyA9IGNvbmZpZy5kZWZhdWx0T3B0aW9ucyB8fCB7fTtcbiAgICB0aGlzLiNxdWVyeURlZmF1bHRzID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbiAgICB0aGlzLiNtdXRhdGlvbkRlZmF1bHRzID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbiAgICB0aGlzLiNtb3VudENvdW50ID0gMDtcbiAgfVxuICBtb3VudCgpIHtcbiAgICB0aGlzLiNtb3VudENvdW50Kys7XG4gICAgaWYgKHRoaXMuI21vdW50Q291bnQgIT09IDEpIHJldHVybjtcbiAgICB0aGlzLiN1bnN1YnNjcmliZUZvY3VzID0gZm9jdXNNYW5hZ2VyLnN1YnNjcmliZShhc3luYyAoZm9jdXNlZCkgPT4ge1xuICAgICAgaWYgKGZvY3VzZWQpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5yZXN1bWVQYXVzZWRNdXRhdGlvbnMoKTtcbiAgICAgICAgdGhpcy4jcXVlcnlDYWNoZS5vbkZvY3VzKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy4jdW5zdWJzY3JpYmVPbmxpbmUgPSBvbmxpbmVNYW5hZ2VyLnN1YnNjcmliZShhc3luYyAob25saW5lKSA9PiB7XG4gICAgICBpZiAob25saW5lKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVzdW1lUGF1c2VkTXV0YXRpb25zKCk7XG4gICAgICAgIHRoaXMuI3F1ZXJ5Q2FjaGUub25PbmxpbmUoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICB1bm1vdW50KCkge1xuICAgIHRoaXMuI21vdW50Q291bnQtLTtcbiAgICBpZiAodGhpcy4jbW91bnRDb3VudCAhPT0gMCkgcmV0dXJuO1xuICAgIHRoaXMuI3Vuc3Vic2NyaWJlRm9jdXM/LigpO1xuICAgIHRoaXMuI3Vuc3Vic2NyaWJlRm9jdXMgPSB2b2lkIDA7XG4gICAgdGhpcy4jdW5zdWJzY3JpYmVPbmxpbmU/LigpO1xuICAgIHRoaXMuI3Vuc3Vic2NyaWJlT25saW5lID0gdm9pZCAwO1xuICB9XG4gIGlzRmV0Y2hpbmcoZmlsdGVycykge1xuICAgIHJldHVybiB0aGlzLiNxdWVyeUNhY2hlLmZpbmRBbGwoeyAuLi5maWx0ZXJzLCBmZXRjaFN0YXR1czogXCJmZXRjaGluZ1wiIH0pLmxlbmd0aDtcbiAgfVxuICBpc011dGF0aW5nKGZpbHRlcnMpIHtcbiAgICByZXR1cm4gdGhpcy4jbXV0YXRpb25DYWNoZS5maW5kQWxsKHsgLi4uZmlsdGVycywgc3RhdHVzOiBcInBlbmRpbmdcIiB9KS5sZW5ndGg7XG4gIH1cbiAgLyoqXG4gICAqIEltcGVyYXRpdmUgKG5vbi1yZWFjdGl2ZSkgd2F5IHRvIHJldHJpZXZlIGRhdGEgZm9yIGEgUXVlcnlLZXkuXG4gICAqIFNob3VsZCBvbmx5IGJlIHVzZWQgaW4gY2FsbGJhY2tzIG9yIGZ1bmN0aW9ucyB3aGVyZSByZWFkaW5nIHRoZSBsYXRlc3QgZGF0YSBpcyBuZWNlc3NhcnksIGUuZy4gZm9yIG9wdGltaXN0aWMgdXBkYXRlcy5cbiAgICpcbiAgICogSGludDogRG8gbm90IHVzZSB0aGlzIGZ1bmN0aW9uIGluc2lkZSBhIGNvbXBvbmVudCwgYmVjYXVzZSBpdCB3b24ndCByZWNlaXZlIHVwZGF0ZXMuXG4gICAqIFVzZSBgdXNlUXVlcnlgIHRvIGNyZWF0ZSBhIGBRdWVyeU9ic2VydmVyYCB0aGF0IHN1YnNjcmliZXMgdG8gY2hhbmdlcy5cbiAgICovXG4gIGdldFF1ZXJ5RGF0YShxdWVyeUtleSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLmRlZmF1bHRRdWVyeU9wdGlvbnMoeyBxdWVyeUtleSB9KTtcbiAgICByZXR1cm4gdGhpcy4jcXVlcnlDYWNoZS5nZXQob3B0aW9ucy5xdWVyeUhhc2gpPy5zdGF0ZS5kYXRhO1xuICB9XG4gIGVuc3VyZVF1ZXJ5RGF0YShvcHRpb25zKSB7XG4gICAgY29uc3QgZGVmYXVsdGVkT3B0aW9ucyA9IHRoaXMuZGVmYXVsdFF1ZXJ5T3B0aW9ucyhvcHRpb25zKTtcbiAgICBjb25zdCBxdWVyeSA9IHRoaXMuI3F1ZXJ5Q2FjaGUuYnVpbGQodGhpcywgZGVmYXVsdGVkT3B0aW9ucyk7XG4gICAgY29uc3QgY2FjaGVkRGF0YSA9IHF1ZXJ5LnN0YXRlLmRhdGE7XG4gICAgaWYgKGNhY2hlZERhdGEgPT09IHZvaWQgMCkge1xuICAgICAgcmV0dXJuIHRoaXMuZmV0Y2hRdWVyeShvcHRpb25zKTtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMucmV2YWxpZGF0ZUlmU3RhbGUgJiYgcXVlcnkuaXNTdGFsZUJ5VGltZShyZXNvbHZlU3RhbGVUaW1lKGRlZmF1bHRlZE9wdGlvbnMuc3RhbGVUaW1lLCBxdWVyeSkpKSB7XG4gICAgICB2b2lkIHRoaXMucHJlZmV0Y2hRdWVyeShkZWZhdWx0ZWRPcHRpb25zKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShjYWNoZWREYXRhKTtcbiAgfVxuICBnZXRRdWVyaWVzRGF0YShmaWx0ZXJzKSB7XG4gICAgcmV0dXJuIHRoaXMuI3F1ZXJ5Q2FjaGUuZmluZEFsbChmaWx0ZXJzKS5tYXAoKHsgcXVlcnlLZXksIHN0YXRlIH0pID0+IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBzdGF0ZS5kYXRhO1xuICAgICAgcmV0dXJuIFtxdWVyeUtleSwgZGF0YV07XG4gICAgfSk7XG4gIH1cbiAgc2V0UXVlcnlEYXRhKHF1ZXJ5S2V5LCB1cGRhdGVyLCBvcHRpb25zKSB7XG4gICAgY29uc3QgZGVmYXVsdGVkT3B0aW9ucyA9IHRoaXMuZGVmYXVsdFF1ZXJ5T3B0aW9ucyh7IHF1ZXJ5S2V5IH0pO1xuICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy4jcXVlcnlDYWNoZS5nZXQoXG4gICAgICBkZWZhdWx0ZWRPcHRpb25zLnF1ZXJ5SGFzaFxuICAgICk7XG4gICAgY29uc3QgcHJldkRhdGEgPSBxdWVyeT8uc3RhdGUuZGF0YTtcbiAgICBjb25zdCBkYXRhID0gZnVuY3Rpb25hbFVwZGF0ZSh1cGRhdGVyLCBwcmV2RGF0YSk7XG4gICAgaWYgKGRhdGEgPT09IHZvaWQgMCkge1xuICAgICAgcmV0dXJuIHZvaWQgMDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuI3F1ZXJ5Q2FjaGUuYnVpbGQodGhpcywgZGVmYXVsdGVkT3B0aW9ucykuc2V0RGF0YShkYXRhLCB7IC4uLm9wdGlvbnMsIG1hbnVhbDogdHJ1ZSB9KTtcbiAgfVxuICBzZXRRdWVyaWVzRGF0YShmaWx0ZXJzLCB1cGRhdGVyLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5vdGlmeU1hbmFnZXIuYmF0Y2goXG4gICAgICAoKSA9PiB0aGlzLiNxdWVyeUNhY2hlLmZpbmRBbGwoZmlsdGVycykubWFwKCh7IHF1ZXJ5S2V5IH0pID0+IFtcbiAgICAgICAgcXVlcnlLZXksXG4gICAgICAgIHRoaXMuc2V0UXVlcnlEYXRhKHF1ZXJ5S2V5LCB1cGRhdGVyLCBvcHRpb25zKVxuICAgICAgXSlcbiAgICApO1xuICB9XG4gIGdldFF1ZXJ5U3RhdGUocXVlcnlLZXkpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5kZWZhdWx0UXVlcnlPcHRpb25zKHsgcXVlcnlLZXkgfSk7XG4gICAgcmV0dXJuIHRoaXMuI3F1ZXJ5Q2FjaGUuZ2V0KFxuICAgICAgb3B0aW9ucy5xdWVyeUhhc2hcbiAgICApPy5zdGF0ZTtcbiAgfVxuICByZW1vdmVRdWVyaWVzKGZpbHRlcnMpIHtcbiAgICBjb25zdCBxdWVyeUNhY2hlID0gdGhpcy4jcXVlcnlDYWNoZTtcbiAgICBub3RpZnlNYW5hZ2VyLmJhdGNoKCgpID0+IHtcbiAgICAgIHF1ZXJ5Q2FjaGUuZmluZEFsbChmaWx0ZXJzKS5mb3JFYWNoKChxdWVyeSkgPT4ge1xuICAgICAgICBxdWVyeUNhY2hlLnJlbW92ZShxdWVyeSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICByZXNldFF1ZXJpZXMoZmlsdGVycywgb3B0aW9ucykge1xuICAgIGNvbnN0IHF1ZXJ5Q2FjaGUgPSB0aGlzLiNxdWVyeUNhY2hlO1xuICAgIHJldHVybiBub3RpZnlNYW5hZ2VyLmJhdGNoKCgpID0+IHtcbiAgICAgIHF1ZXJ5Q2FjaGUuZmluZEFsbChmaWx0ZXJzKS5mb3JFYWNoKChxdWVyeSkgPT4ge1xuICAgICAgICBxdWVyeS5yZXNldCgpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcy5yZWZldGNoUXVlcmllcyhcbiAgICAgICAge1xuICAgICAgICAgIHR5cGU6IFwiYWN0aXZlXCIsXG4gICAgICAgICAgLi4uZmlsdGVyc1xuICAgICAgICB9LFxuICAgICAgICBvcHRpb25zXG4gICAgICApO1xuICAgIH0pO1xuICB9XG4gIGNhbmNlbFF1ZXJpZXMoZmlsdGVycywgY2FuY2VsT3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgZGVmYXVsdGVkQ2FuY2VsT3B0aW9ucyA9IHsgcmV2ZXJ0OiB0cnVlLCAuLi5jYW5jZWxPcHRpb25zIH07XG4gICAgY29uc3QgcHJvbWlzZXMgPSBub3RpZnlNYW5hZ2VyLmJhdGNoKFxuICAgICAgKCkgPT4gdGhpcy4jcXVlcnlDYWNoZS5maW5kQWxsKGZpbHRlcnMpLm1hcCgocXVlcnkpID0+IHF1ZXJ5LmNhbmNlbChkZWZhdWx0ZWRDYW5jZWxPcHRpb25zKSlcbiAgICApO1xuICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihub29wKS5jYXRjaChub29wKTtcbiAgfVxuICBpbnZhbGlkYXRlUXVlcmllcyhmaWx0ZXJzLCBvcHRpb25zID0ge30pIHtcbiAgICByZXR1cm4gbm90aWZ5TWFuYWdlci5iYXRjaCgoKSA9PiB7XG4gICAgICB0aGlzLiNxdWVyeUNhY2hlLmZpbmRBbGwoZmlsdGVycykuZm9yRWFjaCgocXVlcnkpID0+IHtcbiAgICAgICAgcXVlcnkuaW52YWxpZGF0ZSgpO1xuICAgICAgfSk7XG4gICAgICBpZiAoZmlsdGVycz8ucmVmZXRjaFR5cGUgPT09IFwibm9uZVwiKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnJlZmV0Y2hRdWVyaWVzKFxuICAgICAgICB7XG4gICAgICAgICAgLi4uZmlsdGVycyxcbiAgICAgICAgICB0eXBlOiBmaWx0ZXJzPy5yZWZldGNoVHlwZSA/PyBmaWx0ZXJzPy50eXBlID8/IFwiYWN0aXZlXCJcbiAgICAgICAgfSxcbiAgICAgICAgb3B0aW9uc1xuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuICByZWZldGNoUXVlcmllcyhmaWx0ZXJzLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBmZXRjaE9wdGlvbnMgPSB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgY2FuY2VsUmVmZXRjaDogb3B0aW9ucy5jYW5jZWxSZWZldGNoID8/IHRydWVcbiAgICB9O1xuICAgIGNvbnN0IHByb21pc2VzID0gbm90aWZ5TWFuYWdlci5iYXRjaChcbiAgICAgICgpID0+IHRoaXMuI3F1ZXJ5Q2FjaGUuZmluZEFsbChmaWx0ZXJzKS5maWx0ZXIoKHF1ZXJ5KSA9PiAhcXVlcnkuaXNEaXNhYmxlZCgpICYmICFxdWVyeS5pc1N0YXRpYygpKS5tYXAoKHF1ZXJ5KSA9PiB7XG4gICAgICAgIGxldCBwcm9taXNlID0gcXVlcnkuZmV0Y2godm9pZCAwLCBmZXRjaE9wdGlvbnMpO1xuICAgICAgICBpZiAoIWZldGNoT3B0aW9ucy50aHJvd09uRXJyb3IpIHtcbiAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS5jYXRjaChub29wKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcXVlcnkuc3RhdGUuZmV0Y2hTdGF0dXMgPT09IFwicGF1c2VkXCIgPyBQcm9taXNlLnJlc29sdmUoKSA6IHByb21pc2U7XG4gICAgICB9KVxuICAgICk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKG5vb3ApO1xuICB9XG4gIGZldGNoUXVlcnkob3B0aW9ucykge1xuICAgIGNvbnN0IGRlZmF1bHRlZE9wdGlvbnMgPSB0aGlzLmRlZmF1bHRRdWVyeU9wdGlvbnMob3B0aW9ucyk7XG4gICAgaWYgKGRlZmF1bHRlZE9wdGlvbnMucmV0cnkgPT09IHZvaWQgMCkge1xuICAgICAgZGVmYXVsdGVkT3B0aW9ucy5yZXRyeSA9IGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBxdWVyeSA9IHRoaXMuI3F1ZXJ5Q2FjaGUuYnVpbGQodGhpcywgZGVmYXVsdGVkT3B0aW9ucyk7XG4gICAgcmV0dXJuIHF1ZXJ5LmlzU3RhbGVCeVRpbWUoXG4gICAgICByZXNvbHZlU3RhbGVUaW1lKGRlZmF1bHRlZE9wdGlvbnMuc3RhbGVUaW1lLCBxdWVyeSlcbiAgICApID8gcXVlcnkuZmV0Y2goZGVmYXVsdGVkT3B0aW9ucykgOiBQcm9taXNlLnJlc29sdmUocXVlcnkuc3RhdGUuZGF0YSk7XG4gIH1cbiAgcHJlZmV0Y2hRdWVyeShvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuZmV0Y2hRdWVyeShvcHRpb25zKS50aGVuKG5vb3ApLmNhdGNoKG5vb3ApO1xuICB9XG4gIGZldGNoSW5maW5pdGVRdWVyeShvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5iZWhhdmlvciA9IGluZmluaXRlUXVlcnlCZWhhdmlvcihvcHRpb25zLnBhZ2VzKTtcbiAgICByZXR1cm4gdGhpcy5mZXRjaFF1ZXJ5KG9wdGlvbnMpO1xuICB9XG4gIHByZWZldGNoSW5maW5pdGVRdWVyeShvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuZmV0Y2hJbmZpbml0ZVF1ZXJ5KG9wdGlvbnMpLnRoZW4obm9vcCkuY2F0Y2gobm9vcCk7XG4gIH1cbiAgZW5zdXJlSW5maW5pdGVRdWVyeURhdGEob3B0aW9ucykge1xuICAgIG9wdGlvbnMuYmVoYXZpb3IgPSBpbmZpbml0ZVF1ZXJ5QmVoYXZpb3Iob3B0aW9ucy5wYWdlcyk7XG4gICAgcmV0dXJuIHRoaXMuZW5zdXJlUXVlcnlEYXRhKG9wdGlvbnMpO1xuICB9XG4gIHJlc3VtZVBhdXNlZE11dGF0aW9ucygpIHtcbiAgICBpZiAob25saW5lTWFuYWdlci5pc09ubGluZSgpKSB7XG4gICAgICByZXR1cm4gdGhpcy4jbXV0YXRpb25DYWNoZS5yZXN1bWVQYXVzZWRNdXRhdGlvbnMoKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG4gIGdldFF1ZXJ5Q2FjaGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI3F1ZXJ5Q2FjaGU7XG4gIH1cbiAgZ2V0TXV0YXRpb25DYWNoZSgpIHtcbiAgICByZXR1cm4gdGhpcy4jbXV0YXRpb25DYWNoZTtcbiAgfVxuICBnZXREZWZhdWx0T3B0aW9ucygpIHtcbiAgICByZXR1cm4gdGhpcy4jZGVmYXVsdE9wdGlvbnM7XG4gIH1cbiAgc2V0RGVmYXVsdE9wdGlvbnMob3B0aW9ucykge1xuICAgIHRoaXMuI2RlZmF1bHRPcHRpb25zID0gb3B0aW9ucztcbiAgfVxuICBzZXRRdWVyeURlZmF1bHRzKHF1ZXJ5S2V5LCBvcHRpb25zKSB7XG4gICAgdGhpcy4jcXVlcnlEZWZhdWx0cy5zZXQoaGFzaEtleShxdWVyeUtleSksIHtcbiAgICAgIHF1ZXJ5S2V5LFxuICAgICAgZGVmYXVsdE9wdGlvbnM6IG9wdGlvbnNcbiAgICB9KTtcbiAgfVxuICBnZXRRdWVyeURlZmF1bHRzKHF1ZXJ5S2V5KSB7XG4gICAgY29uc3QgZGVmYXVsdHMgPSBbLi4udGhpcy4jcXVlcnlEZWZhdWx0cy52YWx1ZXMoKV07XG4gICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgZGVmYXVsdHMuZm9yRWFjaCgocXVlcnlEZWZhdWx0KSA9PiB7XG4gICAgICBpZiAocGFydGlhbE1hdGNoS2V5KHF1ZXJ5S2V5LCBxdWVyeURlZmF1bHQucXVlcnlLZXkpKSB7XG4gICAgICAgIE9iamVjdC5hc3NpZ24ocmVzdWx0LCBxdWVyeURlZmF1bHQuZGVmYXVsdE9wdGlvbnMpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgc2V0TXV0YXRpb25EZWZhdWx0cyhtdXRhdGlvbktleSwgb3B0aW9ucykge1xuICAgIHRoaXMuI211dGF0aW9uRGVmYXVsdHMuc2V0KGhhc2hLZXkobXV0YXRpb25LZXkpLCB7XG4gICAgICBtdXRhdGlvbktleSxcbiAgICAgIGRlZmF1bHRPcHRpb25zOiBvcHRpb25zXG4gICAgfSk7XG4gIH1cbiAgZ2V0TXV0YXRpb25EZWZhdWx0cyhtdXRhdGlvbktleSkge1xuICAgIGNvbnN0IGRlZmF1bHRzID0gWy4uLnRoaXMuI211dGF0aW9uRGVmYXVsdHMudmFsdWVzKCldO1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIGRlZmF1bHRzLmZvckVhY2goKHF1ZXJ5RGVmYXVsdCkgPT4ge1xuICAgICAgaWYgKHBhcnRpYWxNYXRjaEtleShtdXRhdGlvbktleSwgcXVlcnlEZWZhdWx0Lm11dGF0aW9uS2V5KSkge1xuICAgICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgcXVlcnlEZWZhdWx0LmRlZmF1bHRPcHRpb25zKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGRlZmF1bHRRdWVyeU9wdGlvbnMob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLl9kZWZhdWx0ZWQpIHtcbiAgICAgIHJldHVybiBvcHRpb25zO1xuICAgIH1cbiAgICBjb25zdCBkZWZhdWx0ZWRPcHRpb25zID0ge1xuICAgICAgLi4udGhpcy4jZGVmYXVsdE9wdGlvbnMucXVlcmllcyxcbiAgICAgIC4uLnRoaXMuZ2V0UXVlcnlEZWZhdWx0cyhvcHRpb25zLnF1ZXJ5S2V5KSxcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICBfZGVmYXVsdGVkOiB0cnVlXG4gICAgfTtcbiAgICBpZiAoIWRlZmF1bHRlZE9wdGlvbnMucXVlcnlIYXNoKSB7XG4gICAgICBkZWZhdWx0ZWRPcHRpb25zLnF1ZXJ5SGFzaCA9IGhhc2hRdWVyeUtleUJ5T3B0aW9ucyhcbiAgICAgICAgZGVmYXVsdGVkT3B0aW9ucy5xdWVyeUtleSxcbiAgICAgICAgZGVmYXVsdGVkT3B0aW9uc1xuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKGRlZmF1bHRlZE9wdGlvbnMucmVmZXRjaE9uUmVjb25uZWN0ID09PSB2b2lkIDApIHtcbiAgICAgIGRlZmF1bHRlZE9wdGlvbnMucmVmZXRjaE9uUmVjb25uZWN0ID0gZGVmYXVsdGVkT3B0aW9ucy5uZXR3b3JrTW9kZSAhPT0gXCJhbHdheXNcIjtcbiAgICB9XG4gICAgaWYgKGRlZmF1bHRlZE9wdGlvbnMudGhyb3dPbkVycm9yID09PSB2b2lkIDApIHtcbiAgICAgIGRlZmF1bHRlZE9wdGlvbnMudGhyb3dPbkVycm9yID0gISFkZWZhdWx0ZWRPcHRpb25zLnN1c3BlbnNlO1xuICAgIH1cbiAgICBpZiAoIWRlZmF1bHRlZE9wdGlvbnMubmV0d29ya01vZGUgJiYgZGVmYXVsdGVkT3B0aW9ucy5wZXJzaXN0ZXIpIHtcbiAgICAgIGRlZmF1bHRlZE9wdGlvbnMubmV0d29ya01vZGUgPSBcIm9mZmxpbmVGaXJzdFwiO1xuICAgIH1cbiAgICBpZiAoZGVmYXVsdGVkT3B0aW9ucy5xdWVyeUZuID09PSBza2lwVG9rZW4pIHtcbiAgICAgIGRlZmF1bHRlZE9wdGlvbnMuZW5hYmxlZCA9IGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gZGVmYXVsdGVkT3B0aW9ucztcbiAgfVxuICBkZWZhdWx0TXV0YXRpb25PcHRpb25zKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucz8uX2RlZmF1bHRlZCkge1xuICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAuLi50aGlzLiNkZWZhdWx0T3B0aW9ucy5tdXRhdGlvbnMsXG4gICAgICAuLi5vcHRpb25zPy5tdXRhdGlvbktleSAmJiB0aGlzLmdldE11dGF0aW9uRGVmYXVsdHMob3B0aW9ucy5tdXRhdGlvbktleSksXG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgX2RlZmF1bHRlZDogdHJ1ZVxuICAgIH07XG4gIH1cbiAgY2xlYXIoKSB7XG4gICAgdGhpcy4jcXVlcnlDYWNoZS5jbGVhcigpO1xuICAgIHRoaXMuI211dGF0aW9uQ2FjaGUuY2xlYXIoKTtcbiAgfVxufTtcbmV4cG9ydCB7XG4gIFF1ZXJ5Q2xpZW50XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cXVlcnlDbGllbnQuanMubWFwIiwKICAgICIvLyBzcmMvcXVlcnlPYnNlcnZlci50c1xuaW1wb3J0IHsgZm9jdXNNYW5hZ2VyIH0gZnJvbSBcIi4vZm9jdXNNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBub3RpZnlNYW5hZ2VyIH0gZnJvbSBcIi4vbm90aWZ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgZmV0Y2hTdGF0ZSB9IGZyb20gXCIuL3F1ZXJ5LmpzXCI7XG5pbXBvcnQgeyBTdWJzY3JpYmFibGUgfSBmcm9tIFwiLi9zdWJzY3JpYmFibGUuanNcIjtcbmltcG9ydCB7IHBlbmRpbmdUaGVuYWJsZSB9IGZyb20gXCIuL3RoZW5hYmxlLmpzXCI7XG5pbXBvcnQge1xuICBpc1NlcnZlcixcbiAgaXNWYWxpZFRpbWVvdXQsXG4gIG5vb3AsXG4gIHJlcGxhY2VEYXRhLFxuICByZXNvbHZlRW5hYmxlZCxcbiAgcmVzb2x2ZVN0YWxlVGltZSxcbiAgc2hhbGxvd0VxdWFsT2JqZWN0cyxcbiAgdGltZVVudGlsU3RhbGVcbn0gZnJvbSBcIi4vdXRpbHMuanNcIjtcbmltcG9ydCB7IHRpbWVvdXRNYW5hZ2VyIH0gZnJvbSBcIi4vdGltZW91dE1hbmFnZXIuanNcIjtcbnZhciBRdWVyeU9ic2VydmVyID0gY2xhc3MgZXh0ZW5kcyBTdWJzY3JpYmFibGUge1xuICBjb25zdHJ1Y3RvcihjbGllbnQsIG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy4jY2xpZW50ID0gY2xpZW50O1xuICAgIHRoaXMuI3NlbGVjdEVycm9yID0gbnVsbDtcbiAgICB0aGlzLiNjdXJyZW50VGhlbmFibGUgPSBwZW5kaW5nVGhlbmFibGUoKTtcbiAgICB0aGlzLmJpbmRNZXRob2RzKCk7XG4gICAgdGhpcy5zZXRPcHRpb25zKG9wdGlvbnMpO1xuICB9XG4gICNjbGllbnQ7XG4gICNjdXJyZW50UXVlcnkgPSB2b2lkIDA7XG4gICNjdXJyZW50UXVlcnlJbml0aWFsU3RhdGUgPSB2b2lkIDA7XG4gICNjdXJyZW50UmVzdWx0ID0gdm9pZCAwO1xuICAjY3VycmVudFJlc3VsdFN0YXRlO1xuICAjY3VycmVudFJlc3VsdE9wdGlvbnM7XG4gICNjdXJyZW50VGhlbmFibGU7XG4gICNzZWxlY3RFcnJvcjtcbiAgI3NlbGVjdEZuO1xuICAjc2VsZWN0UmVzdWx0O1xuICAvLyBUaGlzIHByb3BlcnR5IGtlZXBzIHRyYWNrIG9mIHRoZSBsYXN0IHF1ZXJ5IHdpdGggZGVmaW5lZCBkYXRhLlxuICAvLyBJdCB3aWxsIGJlIHVzZWQgdG8gcGFzcyB0aGUgcHJldmlvdXMgZGF0YSBhbmQgcXVlcnkgdG8gdGhlIHBsYWNlaG9sZGVyIGZ1bmN0aW9uIGJldHdlZW4gcmVuZGVycy5cbiAgI2xhc3RRdWVyeVdpdGhEZWZpbmVkRGF0YTtcbiAgI3N0YWxlVGltZW91dElkO1xuICAjcmVmZXRjaEludGVydmFsSWQ7XG4gICNjdXJyZW50UmVmZXRjaEludGVydmFsO1xuICAjdHJhY2tlZFByb3BzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgYmluZE1ldGhvZHMoKSB7XG4gICAgdGhpcy5yZWZldGNoID0gdGhpcy5yZWZldGNoLmJpbmQodGhpcyk7XG4gIH1cbiAgb25TdWJzY3JpYmUoKSB7XG4gICAgaWYgKHRoaXMubGlzdGVuZXJzLnNpemUgPT09IDEpIHtcbiAgICAgIHRoaXMuI2N1cnJlbnRRdWVyeS5hZGRPYnNlcnZlcih0aGlzKTtcbiAgICAgIGlmIChzaG91bGRGZXRjaE9uTW91bnQodGhpcy4jY3VycmVudFF1ZXJ5LCB0aGlzLm9wdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuI2V4ZWN1dGVGZXRjaCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy51cGRhdGVSZXN1bHQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuI3VwZGF0ZVRpbWVycygpO1xuICAgIH1cbiAgfVxuICBvblVuc3Vic2NyaWJlKCkge1xuICAgIGlmICghdGhpcy5oYXNMaXN0ZW5lcnMoKSkge1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuICB9XG4gIHNob3VsZEZldGNoT25SZWNvbm5lY3QoKSB7XG4gICAgcmV0dXJuIHNob3VsZEZldGNoT24oXG4gICAgICB0aGlzLiNjdXJyZW50UXVlcnksXG4gICAgICB0aGlzLm9wdGlvbnMsXG4gICAgICB0aGlzLm9wdGlvbnMucmVmZXRjaE9uUmVjb25uZWN0XG4gICAgKTtcbiAgfVxuICBzaG91bGRGZXRjaE9uV2luZG93Rm9jdXMoKSB7XG4gICAgcmV0dXJuIHNob3VsZEZldGNoT24oXG4gICAgICB0aGlzLiNjdXJyZW50UXVlcnksXG4gICAgICB0aGlzLm9wdGlvbnMsXG4gICAgICB0aGlzLm9wdGlvbnMucmVmZXRjaE9uV2luZG93Rm9jdXNcbiAgICApO1xuICB9XG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICAgIHRoaXMuI2NsZWFyU3RhbGVUaW1lb3V0KCk7XG4gICAgdGhpcy4jY2xlYXJSZWZldGNoSW50ZXJ2YWwoKTtcbiAgICB0aGlzLiNjdXJyZW50UXVlcnkucmVtb3ZlT2JzZXJ2ZXIodGhpcyk7XG4gIH1cbiAgc2V0T3B0aW9ucyhvcHRpb25zKSB7XG4gICAgY29uc3QgcHJldk9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgY29uc3QgcHJldlF1ZXJ5ID0gdGhpcy4jY3VycmVudFF1ZXJ5O1xuICAgIHRoaXMub3B0aW9ucyA9IHRoaXMuI2NsaWVudC5kZWZhdWx0UXVlcnlPcHRpb25zKG9wdGlvbnMpO1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlZCAhPT0gdm9pZCAwICYmIHR5cGVvZiB0aGlzLm9wdGlvbnMuZW5hYmxlZCAhPT0gXCJib29sZWFuXCIgJiYgdHlwZW9mIHRoaXMub3B0aW9ucy5lbmFibGVkICE9PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIHJlc29sdmVFbmFibGVkKHRoaXMub3B0aW9ucy5lbmFibGVkLCB0aGlzLiNjdXJyZW50UXVlcnkpICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkV4cGVjdGVkIGVuYWJsZWQgdG8gYmUgYSBib29sZWFuIG9yIGEgY2FsbGJhY2sgdGhhdCByZXR1cm5zIGEgYm9vbGVhblwiXG4gICAgICApO1xuICAgIH1cbiAgICB0aGlzLiN1cGRhdGVRdWVyeSgpO1xuICAgIHRoaXMuI2N1cnJlbnRRdWVyeS5zZXRPcHRpb25zKHRoaXMub3B0aW9ucyk7XG4gICAgaWYgKHByZXZPcHRpb25zLl9kZWZhdWx0ZWQgJiYgIXNoYWxsb3dFcXVhbE9iamVjdHModGhpcy5vcHRpb25zLCBwcmV2T3B0aW9ucykpIHtcbiAgICAgIHRoaXMuI2NsaWVudC5nZXRRdWVyeUNhY2hlKCkubm90aWZ5KHtcbiAgICAgICAgdHlwZTogXCJvYnNlcnZlck9wdGlvbnNVcGRhdGVkXCIsXG4gICAgICAgIHF1ZXJ5OiB0aGlzLiNjdXJyZW50UXVlcnksXG4gICAgICAgIG9ic2VydmVyOiB0aGlzXG4gICAgICB9KTtcbiAgICB9XG4gICAgY29uc3QgbW91bnRlZCA9IHRoaXMuaGFzTGlzdGVuZXJzKCk7XG4gICAgaWYgKG1vdW50ZWQgJiYgc2hvdWxkRmV0Y2hPcHRpb25hbGx5KFxuICAgICAgdGhpcy4jY3VycmVudFF1ZXJ5LFxuICAgICAgcHJldlF1ZXJ5LFxuICAgICAgdGhpcy5vcHRpb25zLFxuICAgICAgcHJldk9wdGlvbnNcbiAgICApKSB7XG4gICAgICB0aGlzLiNleGVjdXRlRmV0Y2goKTtcbiAgICB9XG4gICAgdGhpcy51cGRhdGVSZXN1bHQoKTtcbiAgICBpZiAobW91bnRlZCAmJiAodGhpcy4jY3VycmVudFF1ZXJ5ICE9PSBwcmV2UXVlcnkgfHwgcmVzb2x2ZUVuYWJsZWQodGhpcy5vcHRpb25zLmVuYWJsZWQsIHRoaXMuI2N1cnJlbnRRdWVyeSkgIT09IHJlc29sdmVFbmFibGVkKHByZXZPcHRpb25zLmVuYWJsZWQsIHRoaXMuI2N1cnJlbnRRdWVyeSkgfHwgcmVzb2x2ZVN0YWxlVGltZSh0aGlzLm9wdGlvbnMuc3RhbGVUaW1lLCB0aGlzLiNjdXJyZW50UXVlcnkpICE9PSByZXNvbHZlU3RhbGVUaW1lKHByZXZPcHRpb25zLnN0YWxlVGltZSwgdGhpcy4jY3VycmVudFF1ZXJ5KSkpIHtcbiAgICAgIHRoaXMuI3VwZGF0ZVN0YWxlVGltZW91dCgpO1xuICAgIH1cbiAgICBjb25zdCBuZXh0UmVmZXRjaEludGVydmFsID0gdGhpcy4jY29tcHV0ZVJlZmV0Y2hJbnRlcnZhbCgpO1xuICAgIGlmIChtb3VudGVkICYmICh0aGlzLiNjdXJyZW50UXVlcnkgIT09IHByZXZRdWVyeSB8fCByZXNvbHZlRW5hYmxlZCh0aGlzLm9wdGlvbnMuZW5hYmxlZCwgdGhpcy4jY3VycmVudFF1ZXJ5KSAhPT0gcmVzb2x2ZUVuYWJsZWQocHJldk9wdGlvbnMuZW5hYmxlZCwgdGhpcy4jY3VycmVudFF1ZXJ5KSB8fCBuZXh0UmVmZXRjaEludGVydmFsICE9PSB0aGlzLiNjdXJyZW50UmVmZXRjaEludGVydmFsKSkge1xuICAgICAgdGhpcy4jdXBkYXRlUmVmZXRjaEludGVydmFsKG5leHRSZWZldGNoSW50ZXJ2YWwpO1xuICAgIH1cbiAgfVxuICBnZXRPcHRpbWlzdGljUmVzdWx0KG9wdGlvbnMpIHtcbiAgICBjb25zdCBxdWVyeSA9IHRoaXMuI2NsaWVudC5nZXRRdWVyeUNhY2hlKCkuYnVpbGQodGhpcy4jY2xpZW50LCBvcHRpb25zKTtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNyZWF0ZVJlc3VsdChxdWVyeSwgb3B0aW9ucyk7XG4gICAgaWYgKHNob3VsZEFzc2lnbk9ic2VydmVyQ3VycmVudFByb3BlcnRpZXModGhpcywgcmVzdWx0KSkge1xuICAgICAgdGhpcy4jY3VycmVudFJlc3VsdCA9IHJlc3VsdDtcbiAgICAgIHRoaXMuI2N1cnJlbnRSZXN1bHRPcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgdGhpcy4jY3VycmVudFJlc3VsdFN0YXRlID0gdGhpcy4jY3VycmVudFF1ZXJ5LnN0YXRlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGdldEN1cnJlbnRSZXN1bHQoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N1cnJlbnRSZXN1bHQ7XG4gIH1cbiAgdHJhY2tSZXN1bHQocmVzdWx0LCBvblByb3BUcmFja2VkKSB7XG4gICAgcmV0dXJuIG5ldyBQcm94eShyZXN1bHQsIHtcbiAgICAgIGdldDogKHRhcmdldCwga2V5KSA9PiB7XG4gICAgICAgIHRoaXMudHJhY2tQcm9wKGtleSk7XG4gICAgICAgIG9uUHJvcFRyYWNrZWQ/LihrZXkpO1xuICAgICAgICBpZiAoa2V5ID09PSBcInByb21pc2VcIikge1xuICAgICAgICAgIHRoaXMudHJhY2tQcm9wKFwiZGF0YVwiKTtcbiAgICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5leHBlcmltZW50YWxfcHJlZmV0Y2hJblJlbmRlciAmJiB0aGlzLiNjdXJyZW50VGhlbmFibGUuc3RhdHVzID09PSBcInBlbmRpbmdcIikge1xuICAgICAgICAgICAgdGhpcy4jY3VycmVudFRoZW5hYmxlLnJlamVjdChcbiAgICAgICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIFwiZXhwZXJpbWVudGFsX3ByZWZldGNoSW5SZW5kZXIgZmVhdHVyZSBmbGFnIGlzIG5vdCBlbmFibGVkXCJcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFJlZmxlY3QuZ2V0KHRhcmdldCwga2V5KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICB0cmFja1Byb3Aoa2V5KSB7XG4gICAgdGhpcy4jdHJhY2tlZFByb3BzLmFkZChrZXkpO1xuICB9XG4gIGdldEN1cnJlbnRRdWVyeSgpIHtcbiAgICByZXR1cm4gdGhpcy4jY3VycmVudFF1ZXJ5O1xuICB9XG4gIHJlZmV0Y2goeyAuLi5vcHRpb25zIH0gPSB7fSkge1xuICAgIHJldHVybiB0aGlzLmZldGNoKHtcbiAgICAgIC4uLm9wdGlvbnNcbiAgICB9KTtcbiAgfVxuICBmZXRjaE9wdGltaXN0aWMob3B0aW9ucykge1xuICAgIGNvbnN0IGRlZmF1bHRlZE9wdGlvbnMgPSB0aGlzLiNjbGllbnQuZGVmYXVsdFF1ZXJ5T3B0aW9ucyhvcHRpb25zKTtcbiAgICBjb25zdCBxdWVyeSA9IHRoaXMuI2NsaWVudC5nZXRRdWVyeUNhY2hlKCkuYnVpbGQodGhpcy4jY2xpZW50LCBkZWZhdWx0ZWRPcHRpb25zKTtcbiAgICByZXR1cm4gcXVlcnkuZmV0Y2goKS50aGVuKCgpID0+IHRoaXMuY3JlYXRlUmVzdWx0KHF1ZXJ5LCBkZWZhdWx0ZWRPcHRpb25zKSk7XG4gIH1cbiAgZmV0Y2goZmV0Y2hPcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuI2V4ZWN1dGVGZXRjaCh7XG4gICAgICAuLi5mZXRjaE9wdGlvbnMsXG4gICAgICBjYW5jZWxSZWZldGNoOiBmZXRjaE9wdGlvbnMuY2FuY2VsUmVmZXRjaCA/PyB0cnVlXG4gICAgfSkudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVJlc3VsdCgpO1xuICAgICAgcmV0dXJuIHRoaXMuI2N1cnJlbnRSZXN1bHQ7XG4gICAgfSk7XG4gIH1cbiAgI2V4ZWN1dGVGZXRjaChmZXRjaE9wdGlvbnMpIHtcbiAgICB0aGlzLiN1cGRhdGVRdWVyeSgpO1xuICAgIGxldCBwcm9taXNlID0gdGhpcy4jY3VycmVudFF1ZXJ5LmZldGNoKFxuICAgICAgdGhpcy5vcHRpb25zLFxuICAgICAgZmV0Y2hPcHRpb25zXG4gICAgKTtcbiAgICBpZiAoIWZldGNoT3B0aW9ucz8udGhyb3dPbkVycm9yKSB7XG4gICAgICBwcm9taXNlID0gcHJvbWlzZS5jYXRjaChub29wKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb21pc2U7XG4gIH1cbiAgI3VwZGF0ZVN0YWxlVGltZW91dCgpIHtcbiAgICB0aGlzLiNjbGVhclN0YWxlVGltZW91dCgpO1xuICAgIGNvbnN0IHN0YWxlVGltZSA9IHJlc29sdmVTdGFsZVRpbWUoXG4gICAgICB0aGlzLm9wdGlvbnMuc3RhbGVUaW1lLFxuICAgICAgdGhpcy4jY3VycmVudFF1ZXJ5XG4gICAgKTtcbiAgICBpZiAoaXNTZXJ2ZXIgfHwgdGhpcy4jY3VycmVudFJlc3VsdC5pc1N0YWxlIHx8ICFpc1ZhbGlkVGltZW91dChzdGFsZVRpbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRpbWUgPSB0aW1lVW50aWxTdGFsZSh0aGlzLiNjdXJyZW50UmVzdWx0LmRhdGFVcGRhdGVkQXQsIHN0YWxlVGltZSk7XG4gICAgY29uc3QgdGltZW91dCA9IHRpbWUgKyAxO1xuICAgIHRoaXMuI3N0YWxlVGltZW91dElkID0gdGltZW91dE1hbmFnZXIuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuI2N1cnJlbnRSZXN1bHQuaXNTdGFsZSkge1xuICAgICAgICB0aGlzLnVwZGF0ZVJlc3VsdCgpO1xuICAgICAgfVxuICAgIH0sIHRpbWVvdXQpO1xuICB9XG4gICNjb21wdXRlUmVmZXRjaEludGVydmFsKCkge1xuICAgIHJldHVybiAodHlwZW9mIHRoaXMub3B0aW9ucy5yZWZldGNoSW50ZXJ2YWwgPT09IFwiZnVuY3Rpb25cIiA/IHRoaXMub3B0aW9ucy5yZWZldGNoSW50ZXJ2YWwodGhpcy4jY3VycmVudFF1ZXJ5KSA6IHRoaXMub3B0aW9ucy5yZWZldGNoSW50ZXJ2YWwpID8/IGZhbHNlO1xuICB9XG4gICN1cGRhdGVSZWZldGNoSW50ZXJ2YWwobmV4dEludGVydmFsKSB7XG4gICAgdGhpcy4jY2xlYXJSZWZldGNoSW50ZXJ2YWwoKTtcbiAgICB0aGlzLiNjdXJyZW50UmVmZXRjaEludGVydmFsID0gbmV4dEludGVydmFsO1xuICAgIGlmIChpc1NlcnZlciB8fCByZXNvbHZlRW5hYmxlZCh0aGlzLm9wdGlvbnMuZW5hYmxlZCwgdGhpcy4jY3VycmVudFF1ZXJ5KSA9PT0gZmFsc2UgfHwgIWlzVmFsaWRUaW1lb3V0KHRoaXMuI2N1cnJlbnRSZWZldGNoSW50ZXJ2YWwpIHx8IHRoaXMuI2N1cnJlbnRSZWZldGNoSW50ZXJ2YWwgPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy4jcmVmZXRjaEludGVydmFsSWQgPSB0aW1lb3V0TWFuYWdlci5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLnJlZmV0Y2hJbnRlcnZhbEluQmFja2dyb3VuZCB8fCBmb2N1c01hbmFnZXIuaXNGb2N1c2VkKCkpIHtcbiAgICAgICAgdGhpcy4jZXhlY3V0ZUZldGNoKCk7XG4gICAgICB9XG4gICAgfSwgdGhpcy4jY3VycmVudFJlZmV0Y2hJbnRlcnZhbCk7XG4gIH1cbiAgI3VwZGF0ZVRpbWVycygpIHtcbiAgICB0aGlzLiN1cGRhdGVTdGFsZVRpbWVvdXQoKTtcbiAgICB0aGlzLiN1cGRhdGVSZWZldGNoSW50ZXJ2YWwodGhpcy4jY29tcHV0ZVJlZmV0Y2hJbnRlcnZhbCgpKTtcbiAgfVxuICAjY2xlYXJTdGFsZVRpbWVvdXQoKSB7XG4gICAgaWYgKHRoaXMuI3N0YWxlVGltZW91dElkKSB7XG4gICAgICB0aW1lb3V0TWFuYWdlci5jbGVhclRpbWVvdXQodGhpcy4jc3RhbGVUaW1lb3V0SWQpO1xuICAgICAgdGhpcy4jc3RhbGVUaW1lb3V0SWQgPSB2b2lkIDA7XG4gICAgfVxuICB9XG4gICNjbGVhclJlZmV0Y2hJbnRlcnZhbCgpIHtcbiAgICBpZiAodGhpcy4jcmVmZXRjaEludGVydmFsSWQpIHtcbiAgICAgIHRpbWVvdXRNYW5hZ2VyLmNsZWFySW50ZXJ2YWwodGhpcy4jcmVmZXRjaEludGVydmFsSWQpO1xuICAgICAgdGhpcy4jcmVmZXRjaEludGVydmFsSWQgPSB2b2lkIDA7XG4gICAgfVxuICB9XG4gIGNyZWF0ZVJlc3VsdChxdWVyeSwgb3B0aW9ucykge1xuICAgIGNvbnN0IHByZXZRdWVyeSA9IHRoaXMuI2N1cnJlbnRRdWVyeTtcbiAgICBjb25zdCBwcmV2T3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICBjb25zdCBwcmV2UmVzdWx0ID0gdGhpcy4jY3VycmVudFJlc3VsdDtcbiAgICBjb25zdCBwcmV2UmVzdWx0U3RhdGUgPSB0aGlzLiNjdXJyZW50UmVzdWx0U3RhdGU7XG4gICAgY29uc3QgcHJldlJlc3VsdE9wdGlvbnMgPSB0aGlzLiNjdXJyZW50UmVzdWx0T3B0aW9ucztcbiAgICBjb25zdCBxdWVyeUNoYW5nZSA9IHF1ZXJ5ICE9PSBwcmV2UXVlcnk7XG4gICAgY29uc3QgcXVlcnlJbml0aWFsU3RhdGUgPSBxdWVyeUNoYW5nZSA/IHF1ZXJ5LnN0YXRlIDogdGhpcy4jY3VycmVudFF1ZXJ5SW5pdGlhbFN0YXRlO1xuICAgIGNvbnN0IHsgc3RhdGUgfSA9IHF1ZXJ5O1xuICAgIGxldCBuZXdTdGF0ZSA9IHsgLi4uc3RhdGUgfTtcbiAgICBsZXQgaXNQbGFjZWhvbGRlckRhdGEgPSBmYWxzZTtcbiAgICBsZXQgZGF0YTtcbiAgICBpZiAob3B0aW9ucy5fb3B0aW1pc3RpY1Jlc3VsdHMpIHtcbiAgICAgIGNvbnN0IG1vdW50ZWQgPSB0aGlzLmhhc0xpc3RlbmVycygpO1xuICAgICAgY29uc3QgZmV0Y2hPbk1vdW50ID0gIW1vdW50ZWQgJiYgc2hvdWxkRmV0Y2hPbk1vdW50KHF1ZXJ5LCBvcHRpb25zKTtcbiAgICAgIGNvbnN0IGZldGNoT3B0aW9uYWxseSA9IG1vdW50ZWQgJiYgc2hvdWxkRmV0Y2hPcHRpb25hbGx5KHF1ZXJ5LCBwcmV2UXVlcnksIG9wdGlvbnMsIHByZXZPcHRpb25zKTtcbiAgICAgIGlmIChmZXRjaE9uTW91bnQgfHwgZmV0Y2hPcHRpb25hbGx5KSB7XG4gICAgICAgIG5ld1N0YXRlID0ge1xuICAgICAgICAgIC4uLm5ld1N0YXRlLFxuICAgICAgICAgIC4uLmZldGNoU3RhdGUoc3RhdGUuZGF0YSwgcXVlcnkub3B0aW9ucylcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGlmIChvcHRpb25zLl9vcHRpbWlzdGljUmVzdWx0cyA9PT0gXCJpc1Jlc3RvcmluZ1wiKSB7XG4gICAgICAgIG5ld1N0YXRlLmZldGNoU3RhdHVzID0gXCJpZGxlXCI7XG4gICAgICB9XG4gICAgfVxuICAgIGxldCB7IGVycm9yLCBlcnJvclVwZGF0ZWRBdCwgc3RhdHVzIH0gPSBuZXdTdGF0ZTtcbiAgICBkYXRhID0gbmV3U3RhdGUuZGF0YTtcbiAgICBsZXQgc2tpcFNlbGVjdCA9IGZhbHNlO1xuICAgIGlmIChvcHRpb25zLnBsYWNlaG9sZGVyRGF0YSAhPT0gdm9pZCAwICYmIGRhdGEgPT09IHZvaWQgMCAmJiBzdGF0dXMgPT09IFwicGVuZGluZ1wiKSB7XG4gICAgICBsZXQgcGxhY2Vob2xkZXJEYXRhO1xuICAgICAgaWYgKHByZXZSZXN1bHQ/LmlzUGxhY2Vob2xkZXJEYXRhICYmIG9wdGlvbnMucGxhY2Vob2xkZXJEYXRhID09PSBwcmV2UmVzdWx0T3B0aW9ucz8ucGxhY2Vob2xkZXJEYXRhKSB7XG4gICAgICAgIHBsYWNlaG9sZGVyRGF0YSA9IHByZXZSZXN1bHQuZGF0YTtcbiAgICAgICAgc2tpcFNlbGVjdCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwbGFjZWhvbGRlckRhdGEgPSB0eXBlb2Ygb3B0aW9ucy5wbGFjZWhvbGRlckRhdGEgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMucGxhY2Vob2xkZXJEYXRhKFxuICAgICAgICAgIHRoaXMuI2xhc3RRdWVyeVdpdGhEZWZpbmVkRGF0YT8uc3RhdGUuZGF0YSxcbiAgICAgICAgICB0aGlzLiNsYXN0UXVlcnlXaXRoRGVmaW5lZERhdGFcbiAgICAgICAgKSA6IG9wdGlvbnMucGxhY2Vob2xkZXJEYXRhO1xuICAgICAgfVxuICAgICAgaWYgKHBsYWNlaG9sZGVyRGF0YSAhPT0gdm9pZCAwKSB7XG4gICAgICAgIHN0YXR1cyA9IFwic3VjY2Vzc1wiO1xuICAgICAgICBkYXRhID0gcmVwbGFjZURhdGEoXG4gICAgICAgICAgcHJldlJlc3VsdD8uZGF0YSxcbiAgICAgICAgICBwbGFjZWhvbGRlckRhdGEsXG4gICAgICAgICAgb3B0aW9uc1xuICAgICAgICApO1xuICAgICAgICBpc1BsYWNlaG9sZGVyRGF0YSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvcHRpb25zLnNlbGVjdCAmJiBkYXRhICE9PSB2b2lkIDAgJiYgIXNraXBTZWxlY3QpIHtcbiAgICAgIGlmIChwcmV2UmVzdWx0ICYmIGRhdGEgPT09IHByZXZSZXN1bHRTdGF0ZT8uZGF0YSAmJiBvcHRpb25zLnNlbGVjdCA9PT0gdGhpcy4jc2VsZWN0Rm4pIHtcbiAgICAgICAgZGF0YSA9IHRoaXMuI3NlbGVjdFJlc3VsdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy4jc2VsZWN0Rm4gPSBvcHRpb25zLnNlbGVjdDtcbiAgICAgICAgICBkYXRhID0gb3B0aW9ucy5zZWxlY3QoZGF0YSk7XG4gICAgICAgICAgZGF0YSA9IHJlcGxhY2VEYXRhKHByZXZSZXN1bHQ/LmRhdGEsIGRhdGEsIG9wdGlvbnMpO1xuICAgICAgICAgIHRoaXMuI3NlbGVjdFJlc3VsdCA9IGRhdGE7XG4gICAgICAgICAgdGhpcy4jc2VsZWN0RXJyb3IgPSBudWxsO1xuICAgICAgICB9IGNhdGNoIChzZWxlY3RFcnJvcikge1xuICAgICAgICAgIHRoaXMuI3NlbGVjdEVycm9yID0gc2VsZWN0RXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuI3NlbGVjdEVycm9yKSB7XG4gICAgICBlcnJvciA9IHRoaXMuI3NlbGVjdEVycm9yO1xuICAgICAgZGF0YSA9IHRoaXMuI3NlbGVjdFJlc3VsdDtcbiAgICAgIGVycm9yVXBkYXRlZEF0ID0gRGF0ZS5ub3coKTtcbiAgICAgIHN0YXR1cyA9IFwiZXJyb3JcIjtcbiAgICB9XG4gICAgY29uc3QgaXNGZXRjaGluZyA9IG5ld1N0YXRlLmZldGNoU3RhdHVzID09PSBcImZldGNoaW5nXCI7XG4gICAgY29uc3QgaXNQZW5kaW5nID0gc3RhdHVzID09PSBcInBlbmRpbmdcIjtcbiAgICBjb25zdCBpc0Vycm9yID0gc3RhdHVzID09PSBcImVycm9yXCI7XG4gICAgY29uc3QgaXNMb2FkaW5nID0gaXNQZW5kaW5nICYmIGlzRmV0Y2hpbmc7XG4gICAgY29uc3QgaGFzRGF0YSA9IGRhdGEgIT09IHZvaWQgMDtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBzdGF0dXMsXG4gICAgICBmZXRjaFN0YXR1czogbmV3U3RhdGUuZmV0Y2hTdGF0dXMsXG4gICAgICBpc1BlbmRpbmcsXG4gICAgICBpc1N1Y2Nlc3M6IHN0YXR1cyA9PT0gXCJzdWNjZXNzXCIsXG4gICAgICBpc0Vycm9yLFxuICAgICAgaXNJbml0aWFsTG9hZGluZzogaXNMb2FkaW5nLFxuICAgICAgaXNMb2FkaW5nLFxuICAgICAgZGF0YSxcbiAgICAgIGRhdGFVcGRhdGVkQXQ6IG5ld1N0YXRlLmRhdGFVcGRhdGVkQXQsXG4gICAgICBlcnJvcixcbiAgICAgIGVycm9yVXBkYXRlZEF0LFxuICAgICAgZmFpbHVyZUNvdW50OiBuZXdTdGF0ZS5mZXRjaEZhaWx1cmVDb3VudCxcbiAgICAgIGZhaWx1cmVSZWFzb246IG5ld1N0YXRlLmZldGNoRmFpbHVyZVJlYXNvbixcbiAgICAgIGVycm9yVXBkYXRlQ291bnQ6IG5ld1N0YXRlLmVycm9yVXBkYXRlQ291bnQsXG4gICAgICBpc0ZldGNoZWQ6IG5ld1N0YXRlLmRhdGFVcGRhdGVDb3VudCA+IDAgfHwgbmV3U3RhdGUuZXJyb3JVcGRhdGVDb3VudCA+IDAsXG4gICAgICBpc0ZldGNoZWRBZnRlck1vdW50OiBuZXdTdGF0ZS5kYXRhVXBkYXRlQ291bnQgPiBxdWVyeUluaXRpYWxTdGF0ZS5kYXRhVXBkYXRlQ291bnQgfHwgbmV3U3RhdGUuZXJyb3JVcGRhdGVDb3VudCA+IHF1ZXJ5SW5pdGlhbFN0YXRlLmVycm9yVXBkYXRlQ291bnQsXG4gICAgICBpc0ZldGNoaW5nLFxuICAgICAgaXNSZWZldGNoaW5nOiBpc0ZldGNoaW5nICYmICFpc1BlbmRpbmcsXG4gICAgICBpc0xvYWRpbmdFcnJvcjogaXNFcnJvciAmJiAhaGFzRGF0YSxcbiAgICAgIGlzUGF1c2VkOiBuZXdTdGF0ZS5mZXRjaFN0YXR1cyA9PT0gXCJwYXVzZWRcIixcbiAgICAgIGlzUGxhY2Vob2xkZXJEYXRhLFxuICAgICAgaXNSZWZldGNoRXJyb3I6IGlzRXJyb3IgJiYgaGFzRGF0YSxcbiAgICAgIGlzU3RhbGU6IGlzU3RhbGUocXVlcnksIG9wdGlvbnMpLFxuICAgICAgcmVmZXRjaDogdGhpcy5yZWZldGNoLFxuICAgICAgcHJvbWlzZTogdGhpcy4jY3VycmVudFRoZW5hYmxlLFxuICAgICAgaXNFbmFibGVkOiByZXNvbHZlRW5hYmxlZChvcHRpb25zLmVuYWJsZWQsIHF1ZXJ5KSAhPT0gZmFsc2VcbiAgICB9O1xuICAgIGNvbnN0IG5leHRSZXN1bHQgPSByZXN1bHQ7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5leHBlcmltZW50YWxfcHJlZmV0Y2hJblJlbmRlcikge1xuICAgICAgY29uc3QgZmluYWxpemVUaGVuYWJsZUlmUG9zc2libGUgPSAodGhlbmFibGUpID0+IHtcbiAgICAgICAgaWYgKG5leHRSZXN1bHQuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICB0aGVuYWJsZS5yZWplY3QobmV4dFJlc3VsdC5lcnJvcik7XG4gICAgICAgIH0gZWxzZSBpZiAobmV4dFJlc3VsdC5kYXRhICE9PSB2b2lkIDApIHtcbiAgICAgICAgICB0aGVuYWJsZS5yZXNvbHZlKG5leHRSZXN1bHQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBjb25zdCByZWNyZWF0ZVRoZW5hYmxlID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBwZW5kaW5nID0gdGhpcy4jY3VycmVudFRoZW5hYmxlID0gbmV4dFJlc3VsdC5wcm9taXNlID0gcGVuZGluZ1RoZW5hYmxlKCk7XG4gICAgICAgIGZpbmFsaXplVGhlbmFibGVJZlBvc3NpYmxlKHBlbmRpbmcpO1xuICAgICAgfTtcbiAgICAgIGNvbnN0IHByZXZUaGVuYWJsZSA9IHRoaXMuI2N1cnJlbnRUaGVuYWJsZTtcbiAgICAgIHN3aXRjaCAocHJldlRoZW5hYmxlLnN0YXR1cykge1xuICAgICAgICBjYXNlIFwicGVuZGluZ1wiOlxuICAgICAgICAgIGlmIChxdWVyeS5xdWVyeUhhc2ggPT09IHByZXZRdWVyeS5xdWVyeUhhc2gpIHtcbiAgICAgICAgICAgIGZpbmFsaXplVGhlbmFibGVJZlBvc3NpYmxlKHByZXZUaGVuYWJsZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiZnVsZmlsbGVkXCI6XG4gICAgICAgICAgaWYgKG5leHRSZXN1bHQuc3RhdHVzID09PSBcImVycm9yXCIgfHwgbmV4dFJlc3VsdC5kYXRhICE9PSBwcmV2VGhlbmFibGUudmFsdWUpIHtcbiAgICAgICAgICAgIHJlY3JlYXRlVGhlbmFibGUoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJyZWplY3RlZFwiOlxuICAgICAgICAgIGlmIChuZXh0UmVzdWx0LnN0YXR1cyAhPT0gXCJlcnJvclwiIHx8IG5leHRSZXN1bHQuZXJyb3IgIT09IHByZXZUaGVuYWJsZS5yZWFzb24pIHtcbiAgICAgICAgICAgIHJlY3JlYXRlVGhlbmFibGUoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXh0UmVzdWx0O1xuICB9XG4gIHVwZGF0ZVJlc3VsdCgpIHtcbiAgICBjb25zdCBwcmV2UmVzdWx0ID0gdGhpcy4jY3VycmVudFJlc3VsdDtcbiAgICBjb25zdCBuZXh0UmVzdWx0ID0gdGhpcy5jcmVhdGVSZXN1bHQodGhpcy4jY3VycmVudFF1ZXJ5LCB0aGlzLm9wdGlvbnMpO1xuICAgIHRoaXMuI2N1cnJlbnRSZXN1bHRTdGF0ZSA9IHRoaXMuI2N1cnJlbnRRdWVyeS5zdGF0ZTtcbiAgICB0aGlzLiNjdXJyZW50UmVzdWx0T3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICBpZiAodGhpcy4jY3VycmVudFJlc3VsdFN0YXRlLmRhdGEgIT09IHZvaWQgMCkge1xuICAgICAgdGhpcy4jbGFzdFF1ZXJ5V2l0aERlZmluZWREYXRhID0gdGhpcy4jY3VycmVudFF1ZXJ5O1xuICAgIH1cbiAgICBpZiAoc2hhbGxvd0VxdWFsT2JqZWN0cyhuZXh0UmVzdWx0LCBwcmV2UmVzdWx0KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLiNjdXJyZW50UmVzdWx0ID0gbmV4dFJlc3VsdDtcbiAgICBjb25zdCBzaG91bGROb3RpZnlMaXN0ZW5lcnMgPSAoKSA9PiB7XG4gICAgICBpZiAoIXByZXZSZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBjb25zdCB7IG5vdGlmeU9uQ2hhbmdlUHJvcHMgfSA9IHRoaXMub3B0aW9ucztcbiAgICAgIGNvbnN0IG5vdGlmeU9uQ2hhbmdlUHJvcHNWYWx1ZSA9IHR5cGVvZiBub3RpZnlPbkNoYW5nZVByb3BzID09PSBcImZ1bmN0aW9uXCIgPyBub3RpZnlPbkNoYW5nZVByb3BzKCkgOiBub3RpZnlPbkNoYW5nZVByb3BzO1xuICAgICAgaWYgKG5vdGlmeU9uQ2hhbmdlUHJvcHNWYWx1ZSA9PT0gXCJhbGxcIiB8fCAhbm90aWZ5T25DaGFuZ2VQcm9wc1ZhbHVlICYmICF0aGlzLiN0cmFja2VkUHJvcHMuc2l6ZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGluY2x1ZGVkUHJvcHMgPSBuZXcgU2V0KFxuICAgICAgICBub3RpZnlPbkNoYW5nZVByb3BzVmFsdWUgPz8gdGhpcy4jdHJhY2tlZFByb3BzXG4gICAgICApO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy50aHJvd09uRXJyb3IpIHtcbiAgICAgICAgaW5jbHVkZWRQcm9wcy5hZGQoXCJlcnJvclwiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLiNjdXJyZW50UmVzdWx0KS5zb21lKChrZXkpID0+IHtcbiAgICAgICAgY29uc3QgdHlwZWRLZXkgPSBrZXk7XG4gICAgICAgIGNvbnN0IGNoYW5nZWQgPSB0aGlzLiNjdXJyZW50UmVzdWx0W3R5cGVkS2V5XSAhPT0gcHJldlJlc3VsdFt0eXBlZEtleV07XG4gICAgICAgIHJldHVybiBjaGFuZ2VkICYmIGluY2x1ZGVkUHJvcHMuaGFzKHR5cGVkS2V5KTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgdGhpcy4jbm90aWZ5KHsgbGlzdGVuZXJzOiBzaG91bGROb3RpZnlMaXN0ZW5lcnMoKSB9KTtcbiAgfVxuICAjdXBkYXRlUXVlcnkoKSB7XG4gICAgY29uc3QgcXVlcnkgPSB0aGlzLiNjbGllbnQuZ2V0UXVlcnlDYWNoZSgpLmJ1aWxkKHRoaXMuI2NsaWVudCwgdGhpcy5vcHRpb25zKTtcbiAgICBpZiAocXVlcnkgPT09IHRoaXMuI2N1cnJlbnRRdWVyeSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBwcmV2UXVlcnkgPSB0aGlzLiNjdXJyZW50UXVlcnk7XG4gICAgdGhpcy4jY3VycmVudFF1ZXJ5ID0gcXVlcnk7XG4gICAgdGhpcy4jY3VycmVudFF1ZXJ5SW5pdGlhbFN0YXRlID0gcXVlcnkuc3RhdGU7XG4gICAgaWYgKHRoaXMuaGFzTGlzdGVuZXJzKCkpIHtcbiAgICAgIHByZXZRdWVyeT8ucmVtb3ZlT2JzZXJ2ZXIodGhpcyk7XG4gICAgICBxdWVyeS5hZGRPYnNlcnZlcih0aGlzKTtcbiAgICB9XG4gIH1cbiAgb25RdWVyeVVwZGF0ZSgpIHtcbiAgICB0aGlzLnVwZGF0ZVJlc3VsdCgpO1xuICAgIGlmICh0aGlzLmhhc0xpc3RlbmVycygpKSB7XG4gICAgICB0aGlzLiN1cGRhdGVUaW1lcnMoKTtcbiAgICB9XG4gIH1cbiAgI25vdGlmeShub3RpZnlPcHRpb25zKSB7XG4gICAgbm90aWZ5TWFuYWdlci5iYXRjaCgoKSA9PiB7XG4gICAgICBpZiAobm90aWZ5T3B0aW9ucy5saXN0ZW5lcnMpIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMuZm9yRWFjaCgobGlzdGVuZXIpID0+IHtcbiAgICAgICAgICBsaXN0ZW5lcih0aGlzLiNjdXJyZW50UmVzdWx0KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICB0aGlzLiNjbGllbnQuZ2V0UXVlcnlDYWNoZSgpLm5vdGlmeSh7XG4gICAgICAgIHF1ZXJ5OiB0aGlzLiNjdXJyZW50UXVlcnksXG4gICAgICAgIHR5cGU6IFwib2JzZXJ2ZXJSZXN1bHRzVXBkYXRlZFwiXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufTtcbmZ1bmN0aW9uIHNob3VsZExvYWRPbk1vdW50KHF1ZXJ5LCBvcHRpb25zKSB7XG4gIHJldHVybiByZXNvbHZlRW5hYmxlZChvcHRpb25zLmVuYWJsZWQsIHF1ZXJ5KSAhPT0gZmFsc2UgJiYgcXVlcnkuc3RhdGUuZGF0YSA9PT0gdm9pZCAwICYmICEocXVlcnkuc3RhdGUuc3RhdHVzID09PSBcImVycm9yXCIgJiYgb3B0aW9ucy5yZXRyeU9uTW91bnQgPT09IGZhbHNlKTtcbn1cbmZ1bmN0aW9uIHNob3VsZEZldGNoT25Nb3VudChxdWVyeSwgb3B0aW9ucykge1xuICByZXR1cm4gc2hvdWxkTG9hZE9uTW91bnQocXVlcnksIG9wdGlvbnMpIHx8IHF1ZXJ5LnN0YXRlLmRhdGEgIT09IHZvaWQgMCAmJiBzaG91bGRGZXRjaE9uKHF1ZXJ5LCBvcHRpb25zLCBvcHRpb25zLnJlZmV0Y2hPbk1vdW50KTtcbn1cbmZ1bmN0aW9uIHNob3VsZEZldGNoT24ocXVlcnksIG9wdGlvbnMsIGZpZWxkKSB7XG4gIGlmIChyZXNvbHZlRW5hYmxlZChvcHRpb25zLmVuYWJsZWQsIHF1ZXJ5KSAhPT0gZmFsc2UgJiYgcmVzb2x2ZVN0YWxlVGltZShvcHRpb25zLnN0YWxlVGltZSwgcXVlcnkpICE9PSBcInN0YXRpY1wiKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0eXBlb2YgZmllbGQgPT09IFwiZnVuY3Rpb25cIiA/IGZpZWxkKHF1ZXJ5KSA6IGZpZWxkO1xuICAgIHJldHVybiB2YWx1ZSA9PT0gXCJhbHdheXNcIiB8fCB2YWx1ZSAhPT0gZmFsc2UgJiYgaXNTdGFsZShxdWVyeSwgb3B0aW9ucyk7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuZnVuY3Rpb24gc2hvdWxkRmV0Y2hPcHRpb25hbGx5KHF1ZXJ5LCBwcmV2UXVlcnksIG9wdGlvbnMsIHByZXZPcHRpb25zKSB7XG4gIHJldHVybiAocXVlcnkgIT09IHByZXZRdWVyeSB8fCByZXNvbHZlRW5hYmxlZChwcmV2T3B0aW9ucy5lbmFibGVkLCBxdWVyeSkgPT09IGZhbHNlKSAmJiAoIW9wdGlvbnMuc3VzcGVuc2UgfHwgcXVlcnkuc3RhdGUuc3RhdHVzICE9PSBcImVycm9yXCIpICYmIGlzU3RhbGUocXVlcnksIG9wdGlvbnMpO1xufVxuZnVuY3Rpb24gaXNTdGFsZShxdWVyeSwgb3B0aW9ucykge1xuICByZXR1cm4gcmVzb2x2ZUVuYWJsZWQob3B0aW9ucy5lbmFibGVkLCBxdWVyeSkgIT09IGZhbHNlICYmIHF1ZXJ5LmlzU3RhbGVCeVRpbWUocmVzb2x2ZVN0YWxlVGltZShvcHRpb25zLnN0YWxlVGltZSwgcXVlcnkpKTtcbn1cbmZ1bmN0aW9uIHNob3VsZEFzc2lnbk9ic2VydmVyQ3VycmVudFByb3BlcnRpZXMob2JzZXJ2ZXIsIG9wdGltaXN0aWNSZXN1bHQpIHtcbiAgaWYgKCFzaGFsbG93RXF1YWxPYmplY3RzKG9ic2VydmVyLmdldEN1cnJlbnRSZXN1bHQoKSwgb3B0aW1pc3RpY1Jlc3VsdCkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5leHBvcnQge1xuICBRdWVyeU9ic2VydmVyXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cXVlcnlPYnNlcnZlci5qcy5tYXAiLAogICAgIlwidXNlIGNsaWVudFwiO1xuXG4vLyBzcmMvUXVlcnlDbGllbnRQcm92aWRlci50c3hcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiO1xuaW1wb3J0IHsganN4IH0gZnJvbSBcInJlYWN0L2pzeC1ydW50aW1lXCI7XG52YXIgUXVlcnlDbGllbnRDb250ZXh0ID0gUmVhY3QuY3JlYXRlQ29udGV4dChcbiAgdm9pZCAwXG4pO1xudmFyIHVzZVF1ZXJ5Q2xpZW50ID0gKHF1ZXJ5Q2xpZW50KSA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IFJlYWN0LnVzZUNvbnRleHQoUXVlcnlDbGllbnRDb250ZXh0KTtcbiAgaWYgKHF1ZXJ5Q2xpZW50KSB7XG4gICAgcmV0dXJuIHF1ZXJ5Q2xpZW50O1xuICB9XG4gIGlmICghY2xpZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gUXVlcnlDbGllbnQgc2V0LCB1c2UgUXVlcnlDbGllbnRQcm92aWRlciB0byBzZXQgb25lXCIpO1xuICB9XG4gIHJldHVybiBjbGllbnQ7XG59O1xudmFyIFF1ZXJ5Q2xpZW50UHJvdmlkZXIgPSAoe1xuICBjbGllbnQsXG4gIGNoaWxkcmVuXG59KSA9PiB7XG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY2xpZW50Lm1vdW50KCk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNsaWVudC51bm1vdW50KCk7XG4gICAgfTtcbiAgfSwgW2NsaWVudF0pO1xuICByZXR1cm4gLyogQF9fUFVSRV9fICovIGpzeChRdWVyeUNsaWVudENvbnRleHQuUHJvdmlkZXIsIHsgdmFsdWU6IGNsaWVudCwgY2hpbGRyZW4gfSk7XG59O1xuZXhwb3J0IHtcbiAgUXVlcnlDbGllbnRDb250ZXh0LFxuICBRdWVyeUNsaWVudFByb3ZpZGVyLFxuICB1c2VRdWVyeUNsaWVudFxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVF1ZXJ5Q2xpZW50UHJvdmlkZXIuanMubWFwIiwKICAgICJcInVzZSBjbGllbnRcIjtcblxuLy8gc3JjL0lzUmVzdG9yaW5nUHJvdmlkZXIudHNcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiO1xudmFyIElzUmVzdG9yaW5nQ29udGV4dCA9IFJlYWN0LmNyZWF0ZUNvbnRleHQoZmFsc2UpO1xudmFyIHVzZUlzUmVzdG9yaW5nID0gKCkgPT4gUmVhY3QudXNlQ29udGV4dChJc1Jlc3RvcmluZ0NvbnRleHQpO1xudmFyIElzUmVzdG9yaW5nUHJvdmlkZXIgPSBJc1Jlc3RvcmluZ0NvbnRleHQuUHJvdmlkZXI7XG5leHBvcnQge1xuICBJc1Jlc3RvcmluZ1Byb3ZpZGVyLFxuICB1c2VJc1Jlc3RvcmluZ1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUlzUmVzdG9yaW5nUHJvdmlkZXIuanMubWFwIiwKICAgICJcInVzZSBjbGllbnRcIjtcblxuLy8gc3JjL1F1ZXJ5RXJyb3JSZXNldEJvdW5kYXJ5LnRzeFxuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgeyBqc3ggfSBmcm9tIFwicmVhY3QvanN4LXJ1bnRpbWVcIjtcbmZ1bmN0aW9uIGNyZWF0ZVZhbHVlKCkge1xuICBsZXQgaXNSZXNldCA9IGZhbHNlO1xuICByZXR1cm4ge1xuICAgIGNsZWFyUmVzZXQ6ICgpID0+IHtcbiAgICAgIGlzUmVzZXQgPSBmYWxzZTtcbiAgICB9LFxuICAgIHJlc2V0OiAoKSA9PiB7XG4gICAgICBpc1Jlc2V0ID0gdHJ1ZTtcbiAgICB9LFxuICAgIGlzUmVzZXQ6ICgpID0+IHtcbiAgICAgIHJldHVybiBpc1Jlc2V0O1xuICAgIH1cbiAgfTtcbn1cbnZhciBRdWVyeUVycm9yUmVzZXRCb3VuZGFyeUNvbnRleHQgPSBSZWFjdC5jcmVhdGVDb250ZXh0KGNyZWF0ZVZhbHVlKCkpO1xudmFyIHVzZVF1ZXJ5RXJyb3JSZXNldEJvdW5kYXJ5ID0gKCkgPT4gUmVhY3QudXNlQ29udGV4dChRdWVyeUVycm9yUmVzZXRCb3VuZGFyeUNvbnRleHQpO1xudmFyIFF1ZXJ5RXJyb3JSZXNldEJvdW5kYXJ5ID0gKHtcbiAgY2hpbGRyZW5cbn0pID0+IHtcbiAgY29uc3QgW3ZhbHVlXSA9IFJlYWN0LnVzZVN0YXRlKCgpID0+IGNyZWF0ZVZhbHVlKCkpO1xuICByZXR1cm4gLyogQF9fUFVSRV9fICovIGpzeChRdWVyeUVycm9yUmVzZXRCb3VuZGFyeUNvbnRleHQuUHJvdmlkZXIsIHsgdmFsdWUsIGNoaWxkcmVuOiB0eXBlb2YgY2hpbGRyZW4gPT09IFwiZnVuY3Rpb25cIiA/IGNoaWxkcmVuKHZhbHVlKSA6IGNoaWxkcmVuIH0pO1xufTtcbmV4cG9ydCB7XG4gIFF1ZXJ5RXJyb3JSZXNldEJvdW5kYXJ5LFxuICB1c2VRdWVyeUVycm9yUmVzZXRCb3VuZGFyeVxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVF1ZXJ5RXJyb3JSZXNldEJvdW5kYXJ5LmpzLm1hcCIsCiAgICAiXCJ1c2UgY2xpZW50XCI7XG5cbi8vIHNyYy9lcnJvckJvdW5kYXJ5VXRpbHMudHNcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiO1xuaW1wb3J0IHsgc2hvdWxkVGhyb3dFcnJvciB9IGZyb20gXCJAdGFuc3RhY2svcXVlcnktY29yZVwiO1xudmFyIGVuc3VyZVByZXZlbnRFcnJvckJvdW5kYXJ5UmV0cnkgPSAob3B0aW9ucywgZXJyb3JSZXNldEJvdW5kYXJ5KSA9PiB7XG4gIGlmIChvcHRpb25zLnN1c3BlbnNlIHx8IG9wdGlvbnMudGhyb3dPbkVycm9yIHx8IG9wdGlvbnMuZXhwZXJpbWVudGFsX3ByZWZldGNoSW5SZW5kZXIpIHtcbiAgICBpZiAoIWVycm9yUmVzZXRCb3VuZGFyeS5pc1Jlc2V0KCkpIHtcbiAgICAgIG9wdGlvbnMucmV0cnlPbk1vdW50ID0gZmFsc2U7XG4gICAgfVxuICB9XG59O1xudmFyIHVzZUNsZWFyUmVzZXRFcnJvckJvdW5kYXJ5ID0gKGVycm9yUmVzZXRCb3VuZGFyeSkgPT4ge1xuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGVycm9yUmVzZXRCb3VuZGFyeS5jbGVhclJlc2V0KCk7XG4gIH0sIFtlcnJvclJlc2V0Qm91bmRhcnldKTtcbn07XG52YXIgZ2V0SGFzRXJyb3IgPSAoe1xuICByZXN1bHQsXG4gIGVycm9yUmVzZXRCb3VuZGFyeSxcbiAgdGhyb3dPbkVycm9yLFxuICBxdWVyeSxcbiAgc3VzcGVuc2Vcbn0pID0+IHtcbiAgcmV0dXJuIHJlc3VsdC5pc0Vycm9yICYmICFlcnJvclJlc2V0Qm91bmRhcnkuaXNSZXNldCgpICYmICFyZXN1bHQuaXNGZXRjaGluZyAmJiBxdWVyeSAmJiAoc3VzcGVuc2UgJiYgcmVzdWx0LmRhdGEgPT09IHZvaWQgMCB8fCBzaG91bGRUaHJvd0Vycm9yKHRocm93T25FcnJvciwgW3Jlc3VsdC5lcnJvciwgcXVlcnldKSk7XG59O1xuZXhwb3J0IHtcbiAgZW5zdXJlUHJldmVudEVycm9yQm91bmRhcnlSZXRyeSxcbiAgZ2V0SGFzRXJyb3IsXG4gIHVzZUNsZWFyUmVzZXRFcnJvckJvdW5kYXJ5XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXJyb3JCb3VuZGFyeVV0aWxzLmpzLm1hcCIsCiAgICAiLy8gc3JjL3N1c3BlbnNlLnRzXG52YXIgZGVmYXVsdFRocm93T25FcnJvciA9IChfZXJyb3IsIHF1ZXJ5KSA9PiBxdWVyeS5zdGF0ZS5kYXRhID09PSB2b2lkIDA7XG52YXIgZW5zdXJlU3VzcGVuc2VUaW1lcnMgPSAoZGVmYXVsdGVkT3B0aW9ucykgPT4ge1xuICBpZiAoZGVmYXVsdGVkT3B0aW9ucy5zdXNwZW5zZSkge1xuICAgIGNvbnN0IE1JTl9TVVNQRU5TRV9USU1FX01TID0gMWUzO1xuICAgIGNvbnN0IGNsYW1wID0gKHZhbHVlKSA9PiB2YWx1ZSA9PT0gXCJzdGF0aWNcIiA/IHZhbHVlIDogTWF0aC5tYXgodmFsdWUgPz8gTUlOX1NVU1BFTlNFX1RJTUVfTVMsIE1JTl9TVVNQRU5TRV9USU1FX01TKTtcbiAgICBjb25zdCBvcmlnaW5hbFN0YWxlVGltZSA9IGRlZmF1bHRlZE9wdGlvbnMuc3RhbGVUaW1lO1xuICAgIGRlZmF1bHRlZE9wdGlvbnMuc3RhbGVUaW1lID0gdHlwZW9mIG9yaWdpbmFsU3RhbGVUaW1lID09PSBcImZ1bmN0aW9uXCIgPyAoLi4uYXJncykgPT4gY2xhbXAob3JpZ2luYWxTdGFsZVRpbWUoLi4uYXJncykpIDogY2xhbXAob3JpZ2luYWxTdGFsZVRpbWUpO1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdGVkT3B0aW9ucy5nY1RpbWUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIGRlZmF1bHRlZE9wdGlvbnMuZ2NUaW1lID0gTWF0aC5tYXgoXG4gICAgICAgIGRlZmF1bHRlZE9wdGlvbnMuZ2NUaW1lLFxuICAgICAgICBNSU5fU1VTUEVOU0VfVElNRV9NU1xuICAgICAgKTtcbiAgICB9XG4gIH1cbn07XG52YXIgd2lsbEZldGNoID0gKHJlc3VsdCwgaXNSZXN0b3JpbmcpID0+IHJlc3VsdC5pc0xvYWRpbmcgJiYgcmVzdWx0LmlzRmV0Y2hpbmcgJiYgIWlzUmVzdG9yaW5nO1xudmFyIHNob3VsZFN1c3BlbmQgPSAoZGVmYXVsdGVkT3B0aW9ucywgcmVzdWx0KSA9PiBkZWZhdWx0ZWRPcHRpb25zPy5zdXNwZW5zZSAmJiByZXN1bHQuaXNQZW5kaW5nO1xudmFyIGZldGNoT3B0aW1pc3RpYyA9IChkZWZhdWx0ZWRPcHRpb25zLCBvYnNlcnZlciwgZXJyb3JSZXNldEJvdW5kYXJ5KSA9PiBvYnNlcnZlci5mZXRjaE9wdGltaXN0aWMoZGVmYXVsdGVkT3B0aW9ucykuY2F0Y2goKCkgPT4ge1xuICBlcnJvclJlc2V0Qm91bmRhcnkuY2xlYXJSZXNldCgpO1xufSk7XG5leHBvcnQge1xuICBkZWZhdWx0VGhyb3dPbkVycm9yLFxuICBlbnN1cmVTdXNwZW5zZVRpbWVycyxcbiAgZmV0Y2hPcHRpbWlzdGljLFxuICBzaG91bGRTdXNwZW5kLFxuICB3aWxsRmV0Y2hcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdXNwZW5zZS5qcy5tYXAiLAogICAgIlwidXNlIGNsaWVudFwiO1xuXG4vLyBzcmMvdXNlQmFzZVF1ZXJ5LnRzXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tIFwicmVhY3RcIjtcbmltcG9ydCB7IGlzU2VydmVyLCBub29wLCBub3RpZnlNYW5hZ2VyIH0gZnJvbSBcIkB0YW5zdGFjay9xdWVyeS1jb3JlXCI7XG5pbXBvcnQgeyB1c2VRdWVyeUNsaWVudCB9IGZyb20gXCIuL1F1ZXJ5Q2xpZW50UHJvdmlkZXIuanNcIjtcbmltcG9ydCB7IHVzZVF1ZXJ5RXJyb3JSZXNldEJvdW5kYXJ5IH0gZnJvbSBcIi4vUXVlcnlFcnJvclJlc2V0Qm91bmRhcnkuanNcIjtcbmltcG9ydCB7XG4gIGVuc3VyZVByZXZlbnRFcnJvckJvdW5kYXJ5UmV0cnksXG4gIGdldEhhc0Vycm9yLFxuICB1c2VDbGVhclJlc2V0RXJyb3JCb3VuZGFyeVxufSBmcm9tIFwiLi9lcnJvckJvdW5kYXJ5VXRpbHMuanNcIjtcbmltcG9ydCB7IHVzZUlzUmVzdG9yaW5nIH0gZnJvbSBcIi4vSXNSZXN0b3JpbmdQcm92aWRlci5qc1wiO1xuaW1wb3J0IHtcbiAgZW5zdXJlU3VzcGVuc2VUaW1lcnMsXG4gIGZldGNoT3B0aW1pc3RpYyxcbiAgc2hvdWxkU3VzcGVuZCxcbiAgd2lsbEZldGNoXG59IGZyb20gXCIuL3N1c3BlbnNlLmpzXCI7XG5mdW5jdGlvbiB1c2VCYXNlUXVlcnkob3B0aW9ucywgT2JzZXJ2ZXIsIHF1ZXJ5Q2xpZW50KSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgIT09IFwib2JqZWN0XCIgfHwgQXJyYXkuaXNBcnJheShvcHRpb25zKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnQmFkIGFyZ3VtZW50IHR5cGUuIFN0YXJ0aW5nIHdpdGggdjUsIG9ubHkgdGhlIFwiT2JqZWN0XCIgZm9ybSBpcyBhbGxvd2VkIHdoZW4gY2FsbGluZyBxdWVyeSByZWxhdGVkIGZ1bmN0aW9ucy4gUGxlYXNlIHVzZSB0aGUgZXJyb3Igc3RhY2sgdG8gZmluZCB0aGUgY3VscHJpdCBjYWxsLiBNb3JlIGluZm8gaGVyZTogaHR0cHM6Ly90YW5zdGFjay5jb20vcXVlcnkvbGF0ZXN0L2RvY3MvcmVhY3QvZ3VpZGVzL21pZ3JhdGluZy10by12NSNzdXBwb3J0cy1hLXNpbmdsZS1zaWduYXR1cmUtb25lLW9iamVjdCdcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIGNvbnN0IGlzUmVzdG9yaW5nID0gdXNlSXNSZXN0b3JpbmcoKTtcbiAgY29uc3QgZXJyb3JSZXNldEJvdW5kYXJ5ID0gdXNlUXVlcnlFcnJvclJlc2V0Qm91bmRhcnkoKTtcbiAgY29uc3QgY2xpZW50ID0gdXNlUXVlcnlDbGllbnQocXVlcnlDbGllbnQpO1xuICBjb25zdCBkZWZhdWx0ZWRPcHRpb25zID0gY2xpZW50LmRlZmF1bHRRdWVyeU9wdGlvbnMob3B0aW9ucyk7XG4gIGNsaWVudC5nZXREZWZhdWx0T3B0aW9ucygpLnF1ZXJpZXM/Ll9leHBlcmltZW50YWxfYmVmb3JlUXVlcnk/LihcbiAgICBkZWZhdWx0ZWRPcHRpb25zXG4gICk7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICBpZiAoIWRlZmF1bHRlZE9wdGlvbnMucXVlcnlGbikge1xuICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgYFske2RlZmF1bHRlZE9wdGlvbnMucXVlcnlIYXNofV06IE5vIHF1ZXJ5Rm4gd2FzIHBhc3NlZCBhcyBhbiBvcHRpb24sIGFuZCBubyBkZWZhdWx0IHF1ZXJ5Rm4gd2FzIGZvdW5kLiBUaGUgcXVlcnlGbiBwYXJhbWV0ZXIgaXMgb25seSBvcHRpb25hbCB3aGVuIHVzaW5nIGEgZGVmYXVsdCBxdWVyeUZuLiBNb3JlIGluZm8gaGVyZTogaHR0cHM6Ly90YW5zdGFjay5jb20vcXVlcnkvbGF0ZXN0L2RvY3MvZnJhbWV3b3JrL3JlYWN0L2d1aWRlcy9kZWZhdWx0LXF1ZXJ5LWZ1bmN0aW9uYFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgZGVmYXVsdGVkT3B0aW9ucy5fb3B0aW1pc3RpY1Jlc3VsdHMgPSBpc1Jlc3RvcmluZyA/IFwiaXNSZXN0b3JpbmdcIiA6IFwib3B0aW1pc3RpY1wiO1xuICBlbnN1cmVTdXNwZW5zZVRpbWVycyhkZWZhdWx0ZWRPcHRpb25zKTtcbiAgZW5zdXJlUHJldmVudEVycm9yQm91bmRhcnlSZXRyeShkZWZhdWx0ZWRPcHRpb25zLCBlcnJvclJlc2V0Qm91bmRhcnkpO1xuICB1c2VDbGVhclJlc2V0RXJyb3JCb3VuZGFyeShlcnJvclJlc2V0Qm91bmRhcnkpO1xuICBjb25zdCBpc05ld0NhY2hlRW50cnkgPSAhY2xpZW50LmdldFF1ZXJ5Q2FjaGUoKS5nZXQoZGVmYXVsdGVkT3B0aW9ucy5xdWVyeUhhc2gpO1xuICBjb25zdCBbb2JzZXJ2ZXJdID0gUmVhY3QudXNlU3RhdGUoXG4gICAgKCkgPT4gbmV3IE9ic2VydmVyKFxuICAgICAgY2xpZW50LFxuICAgICAgZGVmYXVsdGVkT3B0aW9uc1xuICAgIClcbiAgKTtcbiAgY29uc3QgcmVzdWx0ID0gb2JzZXJ2ZXIuZ2V0T3B0aW1pc3RpY1Jlc3VsdChkZWZhdWx0ZWRPcHRpb25zKTtcbiAgY29uc3Qgc2hvdWxkU3Vic2NyaWJlID0gIWlzUmVzdG9yaW5nICYmIG9wdGlvbnMuc3Vic2NyaWJlZCAhPT0gZmFsc2U7XG4gIFJlYWN0LnVzZVN5bmNFeHRlcm5hbFN0b3JlKFxuICAgIFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgICAgKG9uU3RvcmVDaGFuZ2UpID0+IHtcbiAgICAgICAgY29uc3QgdW5zdWJzY3JpYmUgPSBzaG91bGRTdWJzY3JpYmUgPyBvYnNlcnZlci5zdWJzY3JpYmUobm90aWZ5TWFuYWdlci5iYXRjaENhbGxzKG9uU3RvcmVDaGFuZ2UpKSA6IG5vb3A7XG4gICAgICAgIG9ic2VydmVyLnVwZGF0ZVJlc3VsdCgpO1xuICAgICAgICByZXR1cm4gdW5zdWJzY3JpYmU7XG4gICAgICB9LFxuICAgICAgW29ic2VydmVyLCBzaG91bGRTdWJzY3JpYmVdXG4gICAgKSxcbiAgICAoKSA9PiBvYnNlcnZlci5nZXRDdXJyZW50UmVzdWx0KCksXG4gICAgKCkgPT4gb2JzZXJ2ZXIuZ2V0Q3VycmVudFJlc3VsdCgpXG4gICk7XG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgb2JzZXJ2ZXIuc2V0T3B0aW9ucyhkZWZhdWx0ZWRPcHRpb25zKTtcbiAgfSwgW2RlZmF1bHRlZE9wdGlvbnMsIG9ic2VydmVyXSk7XG4gIGlmIChzaG91bGRTdXNwZW5kKGRlZmF1bHRlZE9wdGlvbnMsIHJlc3VsdCkpIHtcbiAgICB0aHJvdyBmZXRjaE9wdGltaXN0aWMoZGVmYXVsdGVkT3B0aW9ucywgb2JzZXJ2ZXIsIGVycm9yUmVzZXRCb3VuZGFyeSk7XG4gIH1cbiAgaWYgKGdldEhhc0Vycm9yKHtcbiAgICByZXN1bHQsXG4gICAgZXJyb3JSZXNldEJvdW5kYXJ5LFxuICAgIHRocm93T25FcnJvcjogZGVmYXVsdGVkT3B0aW9ucy50aHJvd09uRXJyb3IsXG4gICAgcXVlcnk6IGNsaWVudC5nZXRRdWVyeUNhY2hlKCkuZ2V0KGRlZmF1bHRlZE9wdGlvbnMucXVlcnlIYXNoKSxcbiAgICBzdXNwZW5zZTogZGVmYXVsdGVkT3B0aW9ucy5zdXNwZW5zZVxuICB9KSkge1xuICAgIHRocm93IHJlc3VsdC5lcnJvcjtcbiAgfVxuICA7XG4gIGNsaWVudC5nZXREZWZhdWx0T3B0aW9ucygpLnF1ZXJpZXM/Ll9leHBlcmltZW50YWxfYWZ0ZXJRdWVyeT8uKFxuICAgIGRlZmF1bHRlZE9wdGlvbnMsXG4gICAgcmVzdWx0XG4gICk7XG4gIGlmIChkZWZhdWx0ZWRPcHRpb25zLmV4cGVyaW1lbnRhbF9wcmVmZXRjaEluUmVuZGVyICYmICFpc1NlcnZlciAmJiB3aWxsRmV0Y2gocmVzdWx0LCBpc1Jlc3RvcmluZykpIHtcbiAgICBjb25zdCBwcm9taXNlID0gaXNOZXdDYWNoZUVudHJ5ID8gKFxuICAgICAgLy8gRmV0Y2ggaW1tZWRpYXRlbHkgb24gcmVuZGVyIGluIG9yZGVyIHRvIGVuc3VyZSBgLnByb21pc2VgIGlzIHJlc29sdmVkIGV2ZW4gaWYgdGhlIGNvbXBvbmVudCBpcyB1bm1vdW50ZWRcbiAgICAgIGZldGNoT3B0aW1pc3RpYyhkZWZhdWx0ZWRPcHRpb25zLCBvYnNlcnZlciwgZXJyb3JSZXNldEJvdW5kYXJ5KVxuICAgICkgOiAoXG4gICAgICAvLyBzdWJzY3JpYmUgdG8gdGhlIFwiY2FjaGUgcHJvbWlzZVwiIHNvIHRoYXQgd2UgY2FuIGZpbmFsaXplIHRoZSBjdXJyZW50VGhlbmFibGUgb25jZSBkYXRhIGNvbWVzIGluXG4gICAgICBjbGllbnQuZ2V0UXVlcnlDYWNoZSgpLmdldChkZWZhdWx0ZWRPcHRpb25zLnF1ZXJ5SGFzaCk/LnByb21pc2VcbiAgICApO1xuICAgIHByb21pc2U/LmNhdGNoKG5vb3ApLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgb2JzZXJ2ZXIudXBkYXRlUmVzdWx0KCk7XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuICFkZWZhdWx0ZWRPcHRpb25zLm5vdGlmeU9uQ2hhbmdlUHJvcHMgPyBvYnNlcnZlci50cmFja1Jlc3VsdChyZXN1bHQpIDogcmVzdWx0O1xufVxuZXhwb3J0IHtcbiAgdXNlQmFzZVF1ZXJ5XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXNlQmFzZVF1ZXJ5LmpzLm1hcCIsCiAgICAiXCJ1c2UgY2xpZW50XCI7XG5cbi8vIHNyYy91c2VRdWVyeS50c1xuaW1wb3J0IHsgUXVlcnlPYnNlcnZlciB9IGZyb20gXCJAdGFuc3RhY2svcXVlcnktY29yZVwiO1xuaW1wb3J0IHsgdXNlQmFzZVF1ZXJ5IH0gZnJvbSBcIi4vdXNlQmFzZVF1ZXJ5LmpzXCI7XG5mdW5jdGlvbiB1c2VRdWVyeShvcHRpb25zLCBxdWVyeUNsaWVudCkge1xuICByZXR1cm4gdXNlQmFzZVF1ZXJ5KG9wdGlvbnMsIFF1ZXJ5T2JzZXJ2ZXIsIHF1ZXJ5Q2xpZW50KTtcbn1cbmV4cG9ydCB7XG4gIHVzZVF1ZXJ5XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXNlUXVlcnkuanMubWFw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
