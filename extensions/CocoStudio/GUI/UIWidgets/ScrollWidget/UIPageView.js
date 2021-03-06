/****************************************************************************
 Copyright (c) 2010-2012 cocos2d-x.org

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

cc.PageViewEventType = {
    TURNING: 0
};

cc.PVTouchDir = {
    TOUCHLEFT: 0,
    TOUCHRIGHT: 1
};

/**
 * Base class for cc.UIPageView
 * @class
 * @extends cc.Layout
 */
cc.UIPageView = cc.Layout.extend({
    _curPageIdx: 0,
    _pages: null,
    _touchMoveDir: null,
    _touchStartLocation: 0,
    _touchEndLocation: 0,
    _touchMoveStartLocation: 0,
    _movePagePoint: null,
    _leftChild: null,
    _rightChild: null,
    _leftBoundary: 0,
    _rightBoundary: 0,
    _isAutoScrolling: false,
    _autoScrollDistance: 0,
    _autoScrollSpeed: 0,
    _autoScrollDir: 0,
    _childFocusCancelOffset: 0,
    _eventListener: null,
    _eventSelector: null,
    ctor: function () {
        cc.Layout.prototype.ctor.call(this);
        this._curPageIdx = 0;
        this._pages = [];
        this._touchMoveDir = cc.PVTouchDir.TOUCHLEFT;
        this._touchStartLocation = 0;
        this._touchEndLocation = 0;
        this._touchMoveStartLocation = 0;
        this._movePagePoint = null;
        this._leftChild = null;
        this._rightChild = null;
        this._leftBoundary = 0;
        this._rightBoundary = 0;
        this._isAutoScrolling = false;
        this._autoScrollDistance = 0;
        this._autoScrollSpeed = 0;
        this._autoScrollDir = 0;
        this._childFocusCancelOffset = 5;
        this._eventListener = null;
        this._eventSelector = null;
    },

    init: function () {
        if (cc.Layout.prototype.init.call(this)) {
            this._pages = [];
            this.setClippingEnabled(true);
            this.setUpdateEnabled(true);
            return true;
        }
        return false;
    },

    /**
     * Add a widget to a page of pageview.
     * @param {cc.UIWidget} widget
     * @param {number} pageIdx
     * @param {Boolean} forceCreate
     */
    addWidgetToPage: function (widget, pageIdx, forceCreate) {
        if (!widget) {
            return;
        }
        var pageCount = this._pages.length;
        if (pageIdx < 0 || pageIdx >= pageCount) {
            if (forceCreate) {
                if (pageIdx > pageCount) {
                    cc.log("pageIdx is %d, it will be added as page id [%d]", pageIdx, pageCount);
                }
                var newPage = this.createPage();
                newPage.addChild(widget);
                this.addPage(newPage);
            }
        }
        else {
            var page = this._pages[pageIdx];
            if (page) {
                page.addChild(widget);
            }
        }
    },

    /**
     * create page
     * @returns {cc.Layout}
     */
    createPage: function () {
        var newPage = cc.Layout.create();
        newPage.setSize(this.getSize());
        return newPage;
    },

    /**
     * Push back a page to pageview.
     * @param {cc.Layout} page
     */
    addPage: function (page) {
        if (!page) {
            return;
        }
        if (page.getWidgetType() != cc.WidgetType.Container) {
            return;
        }
        if (cc.ArrayContainsObject(this._pages, page)) {
            return;
        }
        var pSize = page.getSize();
        var pvSize = this.getSize();
        if (!(pSize.width==pvSize.width&&pSize.height==pvSize.height)) {
            cc.log("page size does not match pageview size, it will be force sized!");
            page.setSize(pvSize);
        }
        page.setPosition(cc.p(this.getPositionXByIndex(this._pages.length), 0));
        this._pages.push(page);
        this.addChild(page);
        this.updateBoundaryPages();
    },

    /**
     * Inert a page to pageview.
     * @param {cc.Layout} page
     * @param {Number} idx
     */
    insertPage: function (page, idx) {
        if (idx < 0) {
            return;
        }
        if (!page) {
            return;
        }
        if (page.getWidgetType() != cc.WidgetType.Container) {
            return;
        }
        if (cc.ArrayContainsObject(this._pages, page)) {
            return;
        }

        var pageCount = this._pages.length;
        if (idx >= pageCount) {
            this.addPage(page);
        }
        else {
            cc.ArrayAppendObjectToIndex(this._pages, page, idx);
            page.setPosition(cc.p(this.getPositionXByIndex(idx), 0));
            this.addChild(page);
            var pSize = page.getSize();
            var pvSize = this.getSize();
            if (!pSize.equals(pvSize)) {
                cc.log("page size does not match pageview size, it will be force sized!");
                page.setSize(pvSize);
            }
            var arrayPages = this._pages;
            var length = arrayPages.length;
            for (var i = (idx + 1); i < length; i++) {
                var behindPage = arrayPages[i];
                var formerPos = behindPage.getPosition();
                behindPage.setPosition(cc.p(formerPos.x + this.getSize().width, 0));
            }
            this.updateBoundaryPages();
        }
    },

    /**
     * Remove a page of pageview.
     * @param {cc.Layout} page
     */
    removePage: function (page) {
        if (!page) {
            return;
        }
        this.removeChild(page);
        this.updateChildrenPosition();
        this.updateBoundaryPages();
    },

    /**
     * Remove a page at index of pageview.
     * @param {number} index
     */
    removePageAtIndex: function (index) {
        if (index < 0 || index >= this._pages.length) {
            return;
        }
        var page = this._pages[index];
        if (page) {
            this.removePage(page);
        }
    },

    updateBoundaryPages: function () {
        if (this._pages.length <= 0) {
            this._leftChild = null;
            this._rightChild = null;
            return;
        }
        this._leftChild = this._pages[0];
        this._rightChild = this._pages[this._pages.length-1];
    },

    /**
     * Get x position by index
     * @param {number} idx
     * @returns {number}
     */
    getPositionXByIndex: function (idx) {
        return (this.getSize().width * (idx - this._curPageIdx));
    },

    /**
     * Add widget
     * @param {cc.UIWidget} widget
     * @returns {boolean}
     */
    addChild: function (widget) {
        return cc.Layout.prototype.addChild.call(this, widget);
    },

    /**
     *  remove widget child override
     * @param {cc.UIWidget} child
     * @returns {boolean}
     */
    removeChild: function (widget) {
        if (cc.ArrayContainsObject(this._pages, widget)) {
            cc.ArrayRemoveObject(this._pages, widget);
            return cc.Layout.prototype.removeChild.call(this, widget);
        }
        return false;
    },

    onSizeChanged: function () {
        cc.Layout.prototype.onSizeChanged.call(this);
        this._rightBoundary = this.getSize().width;
        this.updateChildrenSize();
        this.updateChildrenPosition();
    },

    updateChildrenSize: function () {
        if (!this._pages.length <= 0) {
            return;
        }

        var selfSize = this.getSize();
        for (var i = 0; i < this._pages.length; i++) {
            var page = this._pages[i];
            page.setSize(selfSize);
        }
    },

    updateChildrenPosition: function () {
        if (!this._pages) {
            return;
        }

        var pageCount = this._pages.length;
        if (pageCount <= 0) {
            this._curPageIdx = 0;
            return;
        }
        if (this._curPageIdx >= pageCount) {
            this._curPageIdx = pageCount - 1;
        }
        var pageWidth = this.getSize().width;
        var arrayPages = this._pages;
        for (var i = 0; i < pageCount; i++) {
            var page = arrayPages[i];
            page.setPosition(cc.p((i - this._curPageIdx) * pageWidth, 0));
        }
    },

    removeAllChildren: function () {
        this._pages = [];
        cc.Layout.prototype.removeAllChildren.call(this);
    },

    /**
     * scroll pageview to index.
     * @param {number} idx
     */
    scrollToPage: function (idx) {
        if (idx < 0 || idx >= this._pages.length) {
            return;
        }
        this._curPageIdx = idx;
        var curPage = this._pages[idx];
        this._autoScrollDistance = -(curPage.getPosition().x);
        this._autoScrollSpeed = Math.abs(this._autoScrollDistance) / 0.2;
        this._autoScrollDir = this._autoScrollDistance > 0 ? 1 : 0;
        this._isAutoScrolling = true;
    },

    update: function (dt) {
        if (this._isAutoScrolling) {
            switch (this._autoScrollDir) {
                case 0:
                    var step = this._autoScrollSpeed * dt;
                    if (this._autoScrollDistance + step >= 0.0) {
                        step = -this._autoScrollDistance;
                        this._autoScrollDistance = 0.0;
                        this._isAutoScrolling = false;
                        this.pageTurningEvent();
                    }
                    else {
                        this._autoScrollDistance += step;
                    }
                    this.scrollPages(-step);
                    break;
                    break;
                case 1:
                    var step = this._autoScrollSpeed * dt;
                    if (this._autoScrollDistance - step <= 0.0) {
                        step = this._autoScrollDistance;
                        this._autoScrollDistance = 0.0;
                        this._isAutoScrolling = false;
                        this.pageTurningEvent();
                    }
                    else {
                        this._autoScrollDistance -= step;
                    }
                    this.scrollPages(step);
                    break;
                default:
                    break;
            }
        }
    },

    onTouchBegan: function (touchPoint) {
        var pass = cc.Layout.prototype.onTouchBegan.call(this, touchPoint);
        this.handlePressLogic(touchPoint);
        return pass;
    },

    onTouchMoved: function (touchPoint) {
        this._touchMovePos.x = touchPoint.x;
        this._touchMovePos.y = touchPoint.y;
        this.handleMoveLogic(touchPoint);
        if (this._widgetParent) {
            this._widgetParent.checkChildInfo(1, this, touchPoint);
        }
        this.moveEvent();
        if (!this.hitTest(touchPoint)) {
            this.setFocused(false);
            this.onTouchEnded(touchPoint);
        }
    },

    onTouchEnded: function (touchPoint) {
        cc.Layout.prototype.onTouchEnded.call(this, touchPoint);
        this.handleReleaseLogic(touchPoint);
    },

    movePages: function (offset) {
        var arrayPages = this._pages;
        var length = arrayPages.length;
        for (var i = 0; i < length; i++) {
            var child = arrayPages[i];
            var pos = child.getPosition();
            child.setPosition(cc.p(pos.x + offset, pos.y));
        }
    },

    scrollPages: function (touchOffset) {
        if (this._pages.length <= 0) {
            return false;
        }

        if (!this._leftChild || !this._rightChild) {
            return false;
        }

        var realOffset = touchOffset;

        switch (this._touchMoveDir) {
            case cc.PVTouchDir.TOUCHLEFT: // left
                if (this._rightChild.getRightInParent() + touchOffset <= this._rightBoundary) {
                    realOffset = this._rightBoundary - this._rightChild.getRightInParent();
                    this.movePages(realOffset);
                    return false;
                }
                break;

            case cc.PVTouchDir.TOUCHRIGHT: // right
                if (this._leftChild.getLeftInParent() + touchOffset >= this._leftBoundary) {
                    realOffset = this._leftBoundary - this._leftChild.getLeftInParent();
                    this.movePages(realOffset);
                    return false;
                }
                break;
            default:
                break;
        }

        this.movePages(realOffset);
        return true;
    },

    onTouchCancelled: function (touchPoint) {
        cc.Layout.prototype.onTouchCancelled.call(this, touchPoint);
    },

    handlePressLogic: function (touchPoint) {
        var nsp = this._renderer.convertToNodeSpace(touchPoint);
        this._touchMoveStartLocation = nsp.x;
        this._touchStartLocation = nsp.x;
    },

    handleMoveLogic: function (touchPoint) {
        var nsp = this._renderer.convertToNodeSpace(touchPoint);
        var offset = 0.0;
        var moveX = nsp.x;
        offset = moveX - this._touchMoveStartLocation;
        this._touchMoveStartLocation = moveX;
        if (offset < 0) {
            this._touchMoveDir = cc.PVTouchDir.TOUCHLEFT;
        }
        else if (offset > 0) {
            this._touchMoveDir = cc.PVTouchDir.TOUCHRIGHT;
        }
        this.scrollPages(offset);
    },

    handleReleaseLogic: function (touchPoint) {
        var curPage = this._pages[this._curPageIdx];
        if (curPage) {
            var curPagePos = curPage.getPosition();
            var pageCount = this._pages.length;
            var curPageLocation = curPagePos.x;
            var pageWidth = this.getSize().width;
            var boundary = pageWidth / 2.0;
            if (curPageLocation <= -boundary) {
                if (this._curPageIdx >= pageCount - 1)
                    this.scrollPages(-curPageLocation);
                else
                    this.scrollToPage(this._curPageIdx + 1);
            }
            else if (curPageLocation >= boundary) {
                if (this._curPageIdx <= 0)
                    this.scrollPages(-curPageLocation);
                else
                    this.scrollToPage(this._curPageIdx - 1);
            }
            else {
                this.scrollToPage(this._curPageIdx);
            }
        }
    },

    checkChildInfo: function (handleState, sender, touchPoint) {
        this.interceptTouchEvent(handleState, sender, touchPoint);
    },

    interceptTouchEvent: function (handleState, sender, touchPoint) {
        switch (handleState) {
            case 0:
                this.handlePressLogic(touchPoint);
                break;
            case 1:
                var offset = 0;
                offset = Math.abs(sender.getTouchStartPos().x - touchPoint.x);
                if (offset > this._childFocusCancelOffset) {
                    sender.setFocused(false);
                    this.handleMoveLogic(touchPoint);
                }
                break;
            case 2:
                this.handleReleaseLogic(touchPoint);
                break;

            case 3:
                break;
        }
    },

    pageTurningEvent: function () {
        if (this._eventListener && this._eventSelector) {
            this._eventSelector.call(this._eventListener, this, cc.PageViewEventType.TURNING);
        }
    },

    addEventListener: function (target, selector) {
        this._eventListener = target;
        this._eventSelector = selector;
    },

    getCurPageIndex: function () {
        return this._curPageIdx;
    },

    getDescription: function () {
        return "PageView";
    }
});

cc.UIPageView.create = function () {
    var uiPageView = new cc.UIPageView();
    if (uiPageView && uiPageView.init()) {
        return uiPageView;
    }
    return null;
};