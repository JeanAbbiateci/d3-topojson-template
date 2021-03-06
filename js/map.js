define([
  'd3',
  'template',
  'topojson',
  'utils',
], function(d3, tmpl, topojson, Utils) {

  /*!
   * D3 TopoJSON Template
   * Template that maps a data set to a SVG rendered map of the US.
   * Also has top level filters, tooltips per state, and a slider to navigate the date range.
   *
   * @license Released under the MIT license.
   * @copyright 2013 Jon Chretien
   */

  'use strict';

  /**
   * @constructor
   *
   * @param {Array} states - GeoJSON file of 50 US states and D.C.
   * @param {Array} data - Data set.
   */
  function Map(us, data) {
    // declare variables
    this.us = us;
    this.currentLabel = 0;
    this.data = data;
    this.dates = Object.keys(this.data[0].dates).sort();
    this.firstDate = this.dates[0];
    this.labels = Utils.getLabelNames(this.data[0].dates);
    this.maxValue = this.getMaxOfArray();
    this.minValue = this.getMinOfArray();
    this.filters = null;
    this.slider = null;

    // constants
    this.COLOR_OFFSET = 90;
    this.LEFT_ARROW = 37;
    this.RIGHT_ARROW = 39;

    // cache DOM elements
    this.currentDate = document.querySelector('#js-current-date');
    this.filterContainer = document.querySelector('#js-filter-container');
    this.map = document.querySelector('#js-map');
    this.shell = document.querySelector('#js-shell');
    this.tooltip = document.querySelector('#js-tooltip');

    // display earliest date date
    this.currentDate.textContent = this.firstDate;

    // cache templates
    this.toolTipTemplate = tmpl(document.querySelector('#tooltip-template').innerHTML);

    this.init();
  }

  /**
   * Initializes application.
   */
  Map.prototype.init = function() {
    this.buildFilters();
    this.buildSlider();
    this.buildMap();
    this.attachEventHandlers();
  };

  /**
   * Builds map filters.
   */
  Map.prototype.buildFilters = function() {
    var fragment = document.createDocumentFragment(),
        len = this.labels.length;

    for (var i = 0; i < len; i++) {
      var el = document.createElement('button');
      el.textContent = Utils.createLabelText(this.labels[i]);
      el.dataset.id = [i];
      el.dataset.label = this.labels[i];
      el.classList.add('btn');
      el.classList.add('btn-filter');
      fragment.appendChild(el);
    }

    // add to DOM
    this.filterContainer.appendChild(fragment);

    // add active class to current label
    this.filterContainer.querySelector('[data-label=' + this.labels[this.currentLabel] + ']').classList.add('active');

    // cache DOM elements
    this.filters = document.querySelectorAll('.btn-filter');
  };

  /**
   * Builds slider control.
   */
  Map.prototype.buildSlider = function() {
    var range = document.createElement('input');
    range.setAttribute('id', 'js-slider');
    range.setAttribute('type', 'range');
    range.setAttribute('min', 0);
    range.setAttribute('max', this.dates.length - 1);
    range.setAttribute('step', 1);
    range.setAttribute('value', 0);
    this.shell.insertBefore(range, this.map);

    // cache DOM element
    this.slider = document.querySelector('#js-slider');
  };

  /**
   * Builds d3 map using topojson layer.
   */
  Map.prototype.buildMap = function() {
    var width = 960,
        height = 500,
        self = this;

    // apply the Albers USA projection
    var projection = d3.geo.albersUsa()
        .scale(1070)
        .translate([width / 2, height / 2]);

    var path = d3.geo.path()
        .projection(projection);

    var svg = d3.select(this.map).append('svg')
        .attr('width', width)
        .attr('height', height);

    svg.append('rect')
        .attr('class', 'background')
        .attr('width', width)
        .attr('height', height);

    var g = svg.append('g');

    g.append('g')
        .attr('class', 'states')
      .selectAll('path')
        .data(topojson.feature(this.us, this.us.objects['us-states']).features)
      .enter().append('path')
        .attr('d', path)
        .attr('d', path).attr('data-name', function(d, i) {
          return self.data[i].name;
        })
        .attr('d', path).attr('data-id', function(d, i) {
          return self.data[i].id;
        })
        .data(this.data)
        .attr('fill', function(d) {
          return 'hsl(216, 86%, ' + (self.COLOR_OFFSET - self.getColorRange(d.dates['' + self.firstDate + ''][self.labels[self.currentLabel]])) + '%)';
        });

    g.append('path')
        .datum(topojson.mesh(this.us, this.us.objects['us-states'], function(a, b) { return a !== b; }))
        .attr('id', 'js-state-borders')
        .attr('class', 'state-borders')
        .attr('d', path);
  };

  /**
   * Calculates the color range for the map using linear scales.
   * The input domain is the date with the least values and the date with the most values.
   * The scale's output range is from 0 to 100.
   * @param {Number} data - The values for a certain label on a given date. Example: streams_gt_30 for all regions on 1/1/13.
   * @returns {Number}
   */
  Map.prototype.getColorRange = function(data) {
    var color = d3.scale.linear().domain([this.minValue, this.maxValue]).range([0, 100]);

    return color(data);
  };

  /**
   * Finds the date with the lowest values.
   * @returns {Number}
   */
  Map.prototype.getMinOfArray = function() {
    var self = this,
        minValue;

    minValue = Math.min.apply(Math, this.data.map(function(filteredData) {
      return filteredData.dates[self.firstDate][self.labels[self.currentLabel]];
    }));

    return minValue;
  };

  /**
   * Finds the date with the highest values.
   * @returns {Number}
   */
  Map.prototype.getMaxOfArray = function() {
    var self = this,
        maxValue;

    maxValue = Math.max.apply(Math, this.data.map(function(filteredData) {
      return filteredData.dates[self.firstDate][self.labels[self.currentLabel]];
    }));

    return maxValue;
  };

  /**
   * Attaches event handlers.
   */
  Map.prototype.attachEventHandlers = function() {
    var self = this;

    // states
    [].forEach.call(document.querySelectorAll('[data-name]'), function(el) {
      el.addEventListener('mouseover', self.showTooltip.bind(self), false);
      el.addEventListener('mousemove', self.moveTooltip.bind(self), false);
      el.addEventListener('mouseout', self.hideTooltip.bind(self), false);
    });

    // filters
    [].forEach.call(this.filters, function(el) {
      el.addEventListener('click', self.refresh.bind(self), false);
    });

    // slider
    this.slider.addEventListener('change', this.updateMapValues.bind(this), false);

    // keyboard controls
    document.documentElement.addEventListener('keydown', this.keyboardNavigation.bind(this), false);
  };

  /**
   * Refreshes user interface.
   * @param {Object} event - The event triggered.
   */
  Map.prototype.refresh = function(event) {
    this.updateButtonState(event);
    this.maxValue = this.getMaxOfArray();
    this.minValue = this.getMinOfArray();
    this.updateMapValues();
  };

  /**
   * Updates map colors by shifting array values based on current slider value.
   * Also updates the current date displayed on the page.
   */
  Map.prototype.updateMapValues = function() {
    var index = parseInt(this.slider.value, 10),
        self = this;

    // update date
    this.currentDate.textContent = this.dates[index];

    d3.selectAll('path')
      .data(this.data)
      .transition()
      .attr('fill', function(d) {
        return 'hsl(216, 86%, ' + (self.COLOR_OFFSET - self.getColorRange(d.dates['' + self.dates[index] + ''][self.labels[self.currentLabel]])) + '%)';
    });
  };


  /**
   * Event handler that switches primary label for map and changes button highlight.
   * @param {Object} event - The event triggered.
   */
  Map.prototype.updateButtonState = function(event) {
    event.preventDefault();

    // remove '.active' class on all nav items
    [].forEach.call(this.filters, function(el) {
      el.classList.remove('active');
    });

    event.currentTarget.classList.add('active');

    // update current label id
    this.currentLabel = event.currentTarget.getAttribute('data-id');
  };

  /**
   * Shows tooltip when user hovers over region.
   * @param {Object} event - The event triggered.
   */
  Map.prototype.showTooltip = function(event) {
    this.tooltip.innerHTML = this.toolTipTemplate({
      data: this.data[event.currentTarget.getAttribute('data-id')].dates['' + this.dates[parseInt(this.slider.value, 10)] + ''][this.labels[this.currentLabel]],
      label: Utils.createLabelText(this.labels[this.currentLabel]),
      state: event.currentTarget.getAttribute('data-name')
    });

    // toggle visibility
    this.tooltip.classList.remove('hide');
  };

  /**
   * Hides tooltip when user moves mouse off of region area.
   */
  Map.prototype.hideTooltip = function() {
    this.tooltip.classList.add('hide');
  };

  /**
   * Moves tooltip box when user moves mouse.
   * @param {Object} event - The event triggered.
   */
  Map.prototype.moveTooltip = function(event) {
    this.tooltip.style.left = event.pageX + 5 + 'px';
    this.tooltip.style.top = event.pageY - (parseInt(this.tooltip.clientHeight, 10) - 60) + 'px';
  };

  /**
   * Code logic for right and left arrow keys.
   * @param {Object} event - The event triggered.
   */
  Map.prototype.keyboardNavigation = function(event) {
    if (event.keyCode === this.RIGHT_ARROW) {
      event.preventDefault();

      // increase slider value by 1 if we're not at the end
      if (this.slider.value < this.dates.length - 1) {
        this.slider.value++;
        this.updateMapValues();
      }
    } else if (event.keyCode === this.LEFT_ARROW) {
      event.preventDefault();

      // decrease slider value by 1 if we're not at the beginning
      if (this.slider.value >= 0) {
        this.slider.value--;
        this.updateMapValues();
      }
    }
  };

  return Map;

});
