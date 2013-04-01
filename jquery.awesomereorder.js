/**
 * awesomereorder — a lightweight, simple, drag-and-drop list reordering plugin
 *  clint tseng (clint@dontexplain.com) — 2011-04-03
 *   Licensed under the WTFPL (http://sam.zoy.org/wtfpl/). Do what
 *   you want, but please do let me know what you think.
 */

;(function($)
{
    // quick helper to determine if an element scrolls
    var isScroll = function($elem)
    {
        return ($elem.css('overflow-y') == 'auto') ||
               ($elem.css('overflow-y') == 'scroll')
    };

    // quick helper to determine the top or bottom border width of an elem
    var borderWidth = function($elem, direction)
    {
        return parseInt($elem.css('border-' + direction + '-width'));
    };

    $.fn.awesomereorder = function(options)
    {
        options = $.extend(true, {}, $.fn.awesomereorder.defaults, options);

        return this.each(function()
        {
            var $container = $(this),

                // metadata plugin
                localOptions = $.meta ? $.extend({}, options, $container.data()) : options,

                // grab dragged items
                $items = $container.children(localOptions.listItemSelector),

                // determine whether we're vert or horiz
                directionType = (localOptions.directionType == 'auto') ?
                                (($items.css('display') == 'block') || ($items.css('display') == 'list-item') ? 'v' : 'h') :
                                localOptions.directionType,

                // keep track of active item
                $item,

                // store off our last known position for scroll repetition
                lastPosition,

                // keep track of container scroll
                scrollTimer,

                // and the container that's scrolling
                $scrollParent,

                // and whether we're actively scrolling
                isScrolling = false,

                // and how much to scroll by
                currentScrollSpeed,

                // keep track of item width and height
                cachedWidth, cachedHeight,

                // keep track of our active placeholder
                $placeholder;

            if (localOptions.uiDraggableDefaults !== undefined)
            {
                var overrides = ['start', 'drag', 'stop'];
                for (var i in overrides)
                {
                    if (localOptions.uiDraggableDefaults[overrides[i]] !== undefined)
                    {
                        localOptions[overrides[i]] = localOptions.uiDraggableDefaults[overrides[i]];
                        delete localOptions.uiDraggableDefaults[overrides[i]];
                    }
                }
            }

            var generatePlaceholder = function()
            {
                return $('<div></div>').data('awesomereorder-placeholder', true)
                                       .width(cachedWidth)
                                       .height(cachedHeight);
            };

            var insertPlaceholder = function($target, direction)
            {
                $placeholder.stop().slideUp('fast', function() { $(this).remove(); });
                $placeholder = generatePlaceholder();
                $target[direction]($placeholder);
                $placeholder.hide().slideDown('fast');
            };

            // just to avoid repeating ourselves
            var setScroll = function(callback)
            {
                if (!isScrolling)
                {
                    clearInterval(scrollTimer);
                    scrollTimer = setInterval(callback, 10);
                    isScrolling = true;
                }
            };

            var checkScroll = function(position)
            {
                if ($scrollParent === undefined)
                    return; // bail; we don't have a parent that scrolls.

                var scrollParentOffset = $scrollParent.offset();
                var scrollParentBorderTop = borderWidth($scrollParent, 'top');
                var scrollParentBorderBottom = borderWidth($scrollParent, 'bottom');

                if (position.top < (scrollParentOffset.top + localOptions.scrollMargin))
                {
                    currentScrollSpeed = localOptions.scrollSpeed *
                                         Math.min(Math.pow((scrollParentOffset.top + localOptions.scrollMargin +
                                                 scrollParentBorderTop - position.top) /
                                             localOptions.scrollMargin, localOptions.scrollCurve), 1);
                    setScroll(function()
                    {
                        $scrollParent.scrollTop($scrollParent.scrollTop() - currentScrollSpeed);
                        checkHover(lastPosition);
                    });
                }
                else if ((position.top - scrollParentBorderTop + cachedHeight) >
                             (scrollParentOffset.top + $scrollParent.outerHeight(false) -
                              scrollParentBorderBottom - localOptions.scrollMargin))
                {
                    currentScrollSpeed = localOptions.scrollSpeed *
                                         Math.min(Math.pow((position.top + cachedHeight - scrollParentBorderTop -
                                                 (scrollParentOffset.top + $scrollParent.outerHeight(false) -
                                                  scrollParentBorderBottom - localOptions.scrollMargin)) /
                                             localOptions.scrollMargin, localOptions.scrollCurve), 1);
                    setScroll(function()
                    {
                        $scrollParent.scrollTop($scrollParent.scrollTop() + currentScrollSpeed);
                        checkHover(lastPosition);
                    });
                }
                else
                {
                    isScrolling = false;
                    clearInterval(scrollTimer);
                }
            };

            var checkHover = function(position)
            {
                // calculate initial height
                var containerOffset = $container.offset();
                var stackHeight = containerOffset.top + parseInt($container.css('margin-top')) -
                    $container.scrollTop();

                // are we going up or down?
                var direction;
                if (lastPosition === undefined)
                    direction = 0; // check both
                else
                    direction = position.top - lastPosition.top;

                // run through elements to find a match
                var found = false;
                $container.children($(localOptions.listItemSelector)).each(function()
                {
                    var $candidate = $(this);

                    if (!$candidate.is(':visible'))
                        return;

                    if ($candidate.data('awesomereorder-placeholder'))
                    {
                        stackHeight += $candidate.outerHeight(true);
                        return;
                    }

                    var threshold = $candidate.outerHeight(true) * localOptions.activeRange;

                    if ((direction <= 0) && (position.top < (stackHeight + threshold)))
                    {
                        if (!$candidate.prev().data('awesomereorder-placeholder'))
                        {
                            insertPlaceholder($candidate, 'before');
                        }
                        found = true;
                        return false; // found it!
                    }

                    stackHeight += $candidate.outerHeight(true);

                    // compare against bottom of dragged elem for moving down
                    var itemBottom = position.top + $item.outerHeight();
                    if ((direction >= 0) && (itemBottom > (stackHeight - threshold)) &&
                                            (itemBottom < (stackHeight + threshold)))
                    {
                        if (!$candidate.next().data('awesomereorder-placeholder'))
                        {
                            insertPlaceholder($candidate, 'after');
                        }
                        found = true;
                        return false; // found it!
                    }

                    // no matter what, if we've passed the last eligible element,
                    // we're done. it's possible there was no work to be done.
                    if (itemBottom < stackHeight)
                    {
                        found = true; // lying to ourselves, but that's okay
                        return false; // bail
                    }
                });

                // if we didn't find anything, we want the bottom of the container
                if (!found && !$container.children(':last-child').data('awesomereorder-placeholder'))
                {
                    insertPlaceholder($container.children(localOptions.listItemSelector).last(), 'after');
                }
            };

            var dropItem = function($helper)
            {
                $placeholder.after($item.show())
                            .remove();

                $item.trigger('awesomereorder-dropped');
            };

            var draggify = function($elems)
            {
                // init jquery-draggable with our stuff
                $elems.draggable($.extend({}, {
                    addClass: false,
                    axis: (directionType == 'v') ? 'y' : undefined,
                    helper: 'clone',
                    scroll: false, // jquery-ui-draggable's own scroll is garbage; use our own.
                    start: function(event, ui)
                    {
                        // find closest parent that scrolls; measure scroll against that parent
                        $scrollParent = undefined;
                        if (isScroll($container))
                        {
                            $scrollParent = $container;
                        }
                        else
                        {
                            $container.parents().each(function()
                            {
                                var $this = $(this);
                                if (isScroll($this))
                                {
                                    $scrollParent = $this;
                                    return false;
                                }
                            });
                        }

                        // grab our elem
                        $item = $(this);

                        // measure things
                        ui.helper.width($item.width());
                        cachedWidth = $item.outerWidth(true);
                        cachedHeight = $item.outerHeight(true);

                        // drop in a placeholder
                        $placeholder = generatePlaceholder();
                        $item.after($placeholder);

                        // IE8 doesn't deal well with the original element being removed from DOM,
                        // even if you add it to a detached parent to make jQueryUI < 1.8.9 happy.
                        // So instead of removing the original element, let's just hide it.
                        $item.hide();

                        if (typeof localOptions.start == 'function') localOptions.start(event, ui);
                    },
                    drag: function(event, ui)
                    {
                        var currentPosition = { left: ui.offset.left, top: ui.offset.top };
                        checkScroll(currentPosition);
                        checkHover(currentPosition);
                        lastPosition = currentPosition;

                        if (typeof localOptions.drag == 'function') localOptions.drag(event, ui);
                    },
                    stop: function(event, ui)
                    {
                        isScrolling = false;
                        clearInterval(scrollTimer);

                        dropItem(ui.helper);

                        if (typeof localOptions.stop == 'function') localOptions.stop(event, ui);
                    }
                }, localOptions.uiDraggableDefaults));
            };

            draggify($items);

            // bind to events for ipc
            $container.bind('awesomereorder-listupdated', function()
            {
                $items = $container.children(localOptions.listItemSelector);
                draggify($items.filter(':not(.ui-draggable)'));
            });
        });
    };

    $.fn.awesomereorder.defaults = {
        activeRange: 0.3,
        directionType: 'auto',
        drag: null,
        handleSelector: '.',
        listItemSelector: 'li',
        scrollCurve: 3, // eases the edge of of the scrolling zone
        scrollMargin: 40, // in px
        scrollSpeed: 25, // maximum, in px; will be scaled according to distance
        start: null,
        stop: null,
        uiDraggableDefaults: {
            containment: 'parent',
            distance: 5,
            opacity: 0.8
        }
    };
})(jQuery);

