(function () {
    'use strict';

    var module;
    module = angular.module('chrismgilbert.jsonView', []);

    /*
    Credits: Ben Hollis https://github.com/bhollis/jsonview/
    */

    module.directive('jsonView', jsonView);

    function jsonView() {

        /* Usage:   <json-view json-object="vm.myObject"
                               description="The object that I want to keep an eye on"
                               initial-position="top-left"
                               warn-on-close="false"></json-view>      
         */

        var directive = {
            restrict: 'E',
            templateUrl: 'jsonView.directive.html',
            link: link,
            scope: {
                jsonObject: '=',        // Any valid JavaScript object or array to output
                description: '@',       // textual description of what this instance is outputting
                initialPosition: '@',   // either top-left, top-right, bottom-left or bottom-right.
                warnOnClose: '@'        // true/false - should ask for confirmation before closing this instance
            },
            controller: jsonViewController,
            controllerAs: 'dirJsonViewCtrl'
        };

        return directive;

    }

    //////////////////////////////

    jsonViewController.$inject = ['$scope', '$rootScope', '$attrs', '$timeout'];

    function jsonViewController($scope, $rootScope, $attrs, $timeout) {

        var vm = this;

        if (!$rootScope.InstanceCount) {
            $rootScope.InstanceCount = 0;
        }

        vm.isOpen = false;
        vm.timeout = $timeout;

        window.addCollapsedClass = function (el) {

            var re = /collapsed/gi;

            if (el.className.indexOf('collapsed') > -1) {
                el.className = el.className.replace(re, '');
            } else {
                el.className += ' collapsed';
            }

        };

        /*
        * Custom drag function so we don't have to use jQuery UI
        */
        $.fn.drags = function (opt, scopeId) {

            var $el;

            opt = $.extend({ handle: '', cursor: 'move' }, opt);

            //set the element that will be used to drag
            $el = $('.dragme--' + scopeId);

            return $el.css('cursor', opt.cursor).on('mousedown', function (e) {

                var $drag,
                    _this = $('.json-view-holder--' + scopeId), //set the element that will actually be dragged;
                    z_idx,
                    drg_h,
                    drg_w,
                    pos_y,
                    pos_x;

                if (opt.handle === '') {
                    $drag = $(_this).addClass('draggable');
                } else {
                    $drag = $(_this).addClass('active-handle').parent().addClass('draggable');
                }

                z_idx = $drag.css('z-index');
                drg_h = $drag.outerHeight();
                drg_w = $drag.outerWidth();
                pos_y = $drag.offset().top + drg_h - e.pageY;
                pos_x = $drag.offset().left + drg_w - e.pageX;

                $drag.css('z-index', 1000).parents().on('mousemove', function (e) {
                    $('.draggable').offset({
                        top: e.pageY + pos_y - drg_h,
                        left: e.pageX + pos_x - drg_w
                    }).on('mouseup', function () {
                        $(this).removeClass('draggable').css('z-index', z_idx);
                    });
                });

                e.preventDefault(); // disable selection

            }).on('mouseup', function () {

                if (opt.handle === '') {
                    $(this).removeClass('draggable');
                } else {
                    $(this).removeClass('active-handle').parent().removeClass('draggable');
                }

            });

        };

    }

    //link is called each and every time this directive is instantiated
    function link(scope, el, attr, ctrl) {

        var vm = ctrl,
            instance;

        scope.$root.InstanceCount += 1;

        instance = scope.$root.InstanceCount;

        vm.scopeId = scope.$id;
        vm.description = attr.description;
        vm.warnOnClose = (attr.warnOnClose.toUpperCase() === 'TRUE') ? true : false;

        vm.cssXOffset = '10px';
        vm.cssXPos = attr.initialPosition.split('-')[1];
        vm.cssYOffset = 10 + 'px';// + (instance * 60) + 'px';
        vm.cssYPos = attr.initialPosition.split('-')[0];

        vm.timeout(function () {
            $('.json-view-holder--').drags(null, vm.scopeId);
        });

        vm.destroy = function () {

            if (vm.warnOnClose && !confirm('Are you sure you want to close this JSON View?')) {
                return;
            }

            scope.$destroy();
            scope = null;
            el.remove();
            el = null;

        };

        function processJson(json, fnName, objToHighlight) {

            var html = jsonToHTML(json, fnName, objToHighlight);

            vm.timeout(function () {
                $('.json-view-output--' + vm.scopeId).html(html);
            });

        }

        scope.$watch('jsonObject', function (newVal, oldVal) {

            var html;

            if (newVal) {
                processJson(newVal);
            }

        }, true);

        scope.$watch('dirJsonViewCtrl.jsonQuery', function (newVal, oldVal) {

            var html;

            if (newVal && scope.jsonObject) {
                try {
                    if (eval('scope.jsonObject' + newVal)) {            // jshint ignore:line
                        processJson(scope.jsonObject, null, eval('scope.jsonObject' + newVal)); // jshint ignore:line
                    }
                } catch (e) { }
            }

        }, true);

        console.log('JSON View ' + instance + ' registered.');

    }

    /*
     * Json formatting functions
     */
    function htmlEncode(t) {

        return (t !== null) ? t.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

    }

    function decorateWithSpan(value, className, shouldHighlight) {

        if (shouldHighlight) {
            className += ' query-highlight';
        }

        return '<span class="' + htmlEncode(className) + '">' + htmlEncode(value) + '</span>';

    }

    function valueToHTML(value, objToHighlight) {

        var valueType = typeof value,
            output = '',
            isDate = false,
            shouldHighlight = false;

        if (objToHighlight && value === objToHighlight) {
            shouldHighlight = true;
        }

        if (value === null) {
            output += decorateWithSpan('null', 'type-null', shouldHighlight);
        } else if (value && value.constructor == Array) {
            output += arrayToHTML(value, objToHighlight);
        } else if (valueType == 'object') {
            try {
                if (value.getMonth()) {
                    output += decorateWithSpan(value.toString(), 'type-string', shouldHighlight);
                }
            } catch (e) {
                output += objectToHTML(value, objToHighlight);
            }
        } else if (valueType == 'number') {
            output += decorateWithSpan(value, 'type-number', shouldHighlight);
        } else if (valueType == 'string') {
            if (/^https?:\/\/[^\s]+$/.test(value)) {
                output += decorateWithSpan('"', 'type-string') + '<a href="' + htmlEncode(value) + '">' + htmlEncode(value) + '</a>' + decorateWithSpan('"', 'type-string', shouldHighlight);
            } else {
                output += decorateWithSpan('"' + value + '"', 'type-string', shouldHighlight);
            }
        } else if (valueType == 'boolean') {
            output += decorateWithSpan(value, 'type-boolean', shouldHighlight);
        }

        return output;
    }

    function arrayToHTML(json, objToHighlight) {

        var i,
            length = json.length,
            output = '<div class="collapser" onclick="window.addCollapsedClass(this.parentElement)"></div>[<span class="ellipsis"></span><ul class="array collapsible">',
            hasContents = false;

        for (i = 0; i < length; i++) {
            hasContents = true;
            output += '<li><div class="hoverable">';
            output += valueToHTML(json[i], objToHighlight);
            if (i < length - 1) {
                output += ',';
            }
            output += '</div></li>';
        }
        output += '</ul>]';

        if (!hasContents) {
            output = "[ ]";
        }

        return output;
    }

    function objectToHTML(json, objToHighlight) {

        var i,
            key,
            keys = Object.keys(json),
            length = keys.length,
            output = '',
            hasContents = false;

        if (objToHighlight && json === objToHighlight) {
            output = '<div class="collapser" onclick="window.addCollapsedClass(this.parentElement)"></div>{<span class="ellipsis"></span><ul class="obj collapsible query-highlight">';
        } else {
            output = '<div class="collapser" onclick="window.addCollapsedClass(this.parentElement)"></div>{<span class="ellipsis"></span><ul class="obj collapsible">';
        }

        for (i = 0; i < length; i++) {
            key = keys[i];
            hasContents = true;
            output += '<li><div class="hoverable">';
            output += '<span class="property">' + htmlEncode(key) + '</span>: ';
            output += valueToHTML(json[key], objToHighlight);
            if (i < length - 1) {
                output += ',';
            }
            output += '</div></li>';
        }
        output += '</ul>}';

        if (!hasContents) {
            output = "{ }";
        }

        return output;
    }

    function jsonToHTML(json, fnName, objToHighlight) {

        var output = '';

        if (fnName) {
            output += '<div class="callback-function">' + htmlEncode(fnName) + '(</div>';
        }

        output += '<div id="json">';
        output += valueToHTML(json, objToHighlight);
        output += '</div>';

        if (fnName) {
            output += '<div class="callback-function">)</div>';
        }

        return output;
    }

    //////////////////////////////

})();
