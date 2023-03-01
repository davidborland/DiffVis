/*=========================================================================
 
 Name:        d3.lineChart.js
 
 Author:      David Borland, The Renaissance Computing Institute (RENCI)
 
 Copyright:   The Renaissance Computing Institute (RENCI)
 
 Description: Line chart with differential visualization using d3 following the 
              reusable charts convention: http://bost.ocks.org/mike/chart/
 
 =========================================================================*/

(function() {
  d3.lineChart = function() {
        // Size
    var margin = { top: 10, left: 50, bottom: 50, right: 50 },      
        width = 800,
        height = 800,
        innerWidth = function() { return width - margin.left - margin.right; },
        innerHeight = function() { return height - margin.top - margin.bottom; },
        
        // Events
        event = d3.dispatch(""),
        
        // Data
        data = [],
        dataPoints = [],
        
        // Scales
        xScale = d3.time.scale(),
        yScale = d3.scale.linear(), 
        colorScale = d3.scale.linear()
            .range(["#0571b0", "#ccc", "#ca0020"]),
/*            
        opacityScale = d3.scale.linear()        
            .range([0.1, 1]),  
        widthScale = d3.scale.linear()        
            .range([0.5, 2]),  
*/            
        // Axes
        xAxis = d3.svg.axis()
            .scale(xScale)
            .orient("bottom"),
        yAxis = d3.svg.axis()
            .scale(yScale)
            .orient("left"),
      
        // Parameters
        trendLength,
        zeroIntensity = 0.75,
        showArea = false,
        showTrend = false,
        clipArea = false,

        // State
        
        // Start with empty selections
        svg = d3.select(),
        g = d3.select();

    // Create a closure containing the above variables
    function lc(selection) {
      selection.each(function(d) {  
        // Set data
        data = d;
        
        // Add line segments to data
        data.forEach(function(d) { d.segments = d3.pairs(d.data); });
        
        // Initialize regression length
        trendLength = Math.floor(d3.min(data.map(function(d) { return d.data.length; })) / 10);
        
        // Select the svg element, if it exists
        svg = d3.select(this).selectAll("svg")
            .data([data]);
  
        // Otherwise create the skeletal chart
        var svgEnter = svg.enter().append("svg")
            .attr("class", "lineChart")
            .on("mousedown", function() {
              // Stop text highlighting
              d3.event.preventDefault();
            });
            
        // Add background
        svgEnter.append("rect")
            .attr("class", "background")
            .attr("width", "100%")
            .attr("height", "100%")
            .on("click", reset);
        
        // Add main group
        g = svgEnter.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
        // Groups for correct z order
        g.append("g").attr("class", "line");     
        g.append("g").attr("class", "axis");
        
        // Get all data point 
        dataPoints = allPoints();
        
        // Set domains x and y scales
        xScale.domain(d3.extent(dataPoints.map(function(d) { return d.date; })));        
        yScale.domain(d3.extent(dataPoints.map(function(d) { return d.value; })));
            
        // Set width and height
        setWidth(width);
        setHeight(height); 
        
        // Draw
        drawVis();                        
      });
    }
    
    function allPoints() {
      return d3.merge(data.map(function(d) { return d.data; }));
    }
    
    function allSegments() {
      return d3.merge(data.map(function(d) { return d.segments; }));
    }
  
    
    function reset() {
      // Redraw
      drawVis();
    }
        
    function drawVis(transitionTime) {        
      if (transitionTime === undefined) transitionTime = 500;
      
      updateDifference();
      drawLines();
      drawAxes();
      
      function updateDifference() { 
        data.forEach(function(d) {                   
          d.segments.forEach(function(segment, i) {
            // Compute start and stop indeces for linear regression
            var r = Math.floor(trendLength / 2) - 1,
                start = Math.max(i - r, 0),
                stop = Math.min(i + 1 + r, d.data.length - 1);
            
            // Get points for linear regression
            var points = [];
            for (var j = start; j <= stop; j++) {
              points.push([x(d.data[j]), y(d.data[j])]);
            }
            
            // Do linear regression to get slope
            var lr = ss.linearRegression(points);
            
            segment.delta = lr.m;
                        
            segment.lrLine = ss.linearRegressionLine(lr);
            
            function x(d) {
              return xScale(d.date);
            }
            
            function y(d) {
              return yScale.range()[1] - yScale(d.value);
            }
          });
          
          // Loop again so linear regression line is updated for each segment
          d.segments.forEach(function(segment, i, a) {
            var x1 = xScale(segment[0].date),
                x2 = xScale(segment[1].date),
                y1 = yScale.range()[1] - segment.lrLine(x1),
                y2 = yScale.range()[1] - (i < a.length - 1 ? a[i + 1].lrLine(x2) : segment.lrLine(x2));
            
            segment.lrPoints = [[x1, y1], [x2, y2]];  
            
            var d1 = segment.lrPoints[0][1] - yScale(segment[0].value),
                d2 = segment.lrPoints[1][1] - yScale(segment[1].value);
                
            segment.maxDiff = Math.abs(d1) > Math.abs(d2) ? d1 : d2;
          });
          
/*          
          d.data.forEach(function(point, i) {
            var r = Math.floor(trendLength / 2) - 1,
                start = Math.max(i - r, 0),
                stop = Math.min(i + r, d.data.length - 1); 
                
            point.valueSmooth = d3.mean(d.data.slice(start, stop + 1), function(d) { return d.value; });
          });
*/          
        });
          
        // Update scales
        if (showArea && showTrend && clipArea) {
          // Get maximum difference between point and linear regression
          var diffs = allSegments().map(function(d) { return d.maxDiff; }),
              maxAbs = d3.max(diffs, function(d) { return Math.abs(d); });
          
          colorScale.domain([-maxAbs, 0, maxAbs]);
        }
        else {
          // Get maximum deltas
          var deltas = allSegments().map(function(d) { return d.delta; }),
              maxAbs = d3.max(deltas, function(d) { return Math.abs(d); });
      
          colorScale.domain([-maxAbs, 0, maxAbs]);
        }
/*        
        opacityScale.domain([0, maxAbs]);
        widthScale.domain([0, maxAbs]);
*/        
      }
      
      function drawLines() {
        // Bind data for each line
        var line = g.select(".line").selectAll(".line > g")
            .data(data);
          
        // Enter
        var lineEnter = line.enter().append("g");
        
        // Add groups for correct z order
        lineEnter.append("g").attr("class", "area");
        lineEnter.append("g").attr("class", "segment");
        lineEnter.append("g").attr("class", "trend");
//        lineEnter.append("g").attr("class", "smooth");
        
        // Enter + update
        line.call(drawLine);
          
        // Exit
        line.exit().remove();
        
        function drawLine(selection) {
          drawSegments(selection);
          drawAreas(selection);
          drawTrends(selection);
          //drawSmoothed(selection);
          
          function drawSegments(selection) {
            // Bind data for line segments
            var segment = selection.select(".segment").selectAll("line")
                .data(function(d) { return d.segments; });

            // Enter
            segment.enter().append("line");

            // Enter + update
            segment.call(drawSegment);

            // Exit
            segment.exit().remove();
          
            function drawSegment(selection) {
              selection
                  .attr("x1", function(d) { return xScale(d[0].date); })
                  .attr("y1", function(d) { return yScale(d[0].value); })
                  .attr("x2", function(d) { return xScale(d[1].date); })
                  .attr("y2", function(d) { return yScale(d[1].value); })
                  .style("stroke", showArea ? "dimgrey" : function(d) { return colorScale(d.delta); });
  /*              
                  .style("stroke-opacity", function(d) { return opacityScale(Math.abs(d.delta)); })
                  .style("stroke-width", function(d) { return widthScale(Math.abs(d.delta)); });
  */                
            }
          }
          
          function drawAreas(selection) {
            // Bind data for areas
            var area = selection.select(".area").selectAll("polygon")
                .data(showArea ? function(d) { return d.segments; } : []);

            // Enter
            area.enter().append("polygon");

            // Enter + update
            area.call(drawArea);

            // Exit
            area.exit().remove();        
          
            function drawArea(selection) {
              selection
                  .attr("points", function(d) {                  
                    return xScale(d[0].date) + "," + yScale(d[0].value) + " " +
                           xScale(d[0].date) + "," + (showTrend && clipArea ? d.lrPoints[0][1] : yScale.range()[0]) + " " +
                           xScale(d[1].date) + "," + (showTrend && clipArea ? d.lrPoints[1][1] : yScale.range()[0]) + " " +
                           xScale(d[1].date) + "," + yScale(d[1].value);
                  })
                  .style("stroke", color)
                  .style("fill", color);          
          /*
                    .style("stroke", function(d) { 
                      return yScale(d[0].value) > d.lrPoints[0][1] ? colorScale.range()[0] : colorScale.range()[2]; 
                    })
                    .style("fill", function(d) {
                      return yScale(d[0].value) > d.lrPoints[0][1] ? colorScale.range()[0] : colorScale.range()[2]; 
                    }); 
          */
              function color(d) {
                return showTrend && clipArea ? colorScale(d.maxDiff) : colorScale(d.delta);
              }
            } 
          }
          
          function drawTrends(selection) {
            // Bind data for trend lines
            var trend = selection.select(".trend").selectAll("line")
                .data(showTrend ? function(d) { return d.segments; } : []);

            // Enter
            trend.enter().append("line");

            // Enter + update
            trend.call(drawTrend);

            // Exit
            trend.exit().remove();   
          
            function drawTrend(selection) {                       
              selection
                  .attr("x1", function(d) { return d.lrPoints[0][0]; })
                  .attr("y1", function(d) { return d.lrPoints[0][1]; })
                  .attr("x2", function(d) { return d.lrPoints[1][0]; })
                  .attr("y2", function(d) { return d.lrPoints[1][1]; })
                  .style("stroke", "dimgrey");                              
            }
          }   
/*          
          function drawSmoothed(selection) {
            // Bind data for line segments
            var segment = selection.select(".smooth").selectAll("line")
                .data(function(d) { return d.segments; });

            // Enter
            segment.enter().append("line");

            // Enter + update
            segment.call(drawSegment);

            // Exit
            segment.exit().remove();
          
            function drawSegment(selection) {
              selection
                  .attr("x1", function(d) { return xScale(d[0].date); })
                  .attr("y1", function(d) { return yScale(d[0].valueSmooth); })
                  .attr("x2", function(d) { return xScale(d[1].date); })
                  .attr("y2", function(d) { return yScale(d[1].valueSmooth); })
                  .style("stroke", "dimgrey");           
            }
          }
*/          
        }
      }
      
      function drawAxes() {        
        var axis = g.select(".axis");                    
        
        // Draw x axis
        var gXAxis = axis.selectAll(".xAxis")
            .data([0]);
          
        // Enter
        gXAxis.enter().append("g")
            .attr("class", "xAxis")
            .call(x);
        
        // Enter + update
        gXAxis.transition()
            .duration(transitionTime)
            .call(x);

        // Draw y axis
        var gYAxis = axis.selectAll(".yAxis")
            .data([0]);
          
        // Enter
        gYAxis.enter().append("g")
            .attr("class", "yAxis")
            .call(yAxis);
        
        // Enter + update
        gYAxis.transition()
            .duration(transitionTime)
            .call(yAxis);

        function x(selection) {
          selection
              .attr("transform", "translate(0," + innerHeight() + ")")
              .call(xAxis);
        }   
      }
    }
    
    function setWidth(_) {
      width = _;
      
      // Set svg width
      svg.attr("width", width);      
      
      // Set x scale
      xScale.range([0, innerWidth()]);
    }
    
    function setHeight(_) {      
      height = _;
      
      // Set svg height
      svg.attr("height", height);

      // Set y scales
      yScale.range([innerHeight(), 0]);
    }
    
    // Getters/setters
    
    lc.width = function(_) {
      if (!arguments.length) return width;
      
      setWidth(_);
      drawVis();
      
      return lc;
    };
    
    lc.height = function(_) {
      if (!arguments.length) return height;
      
      setHeight(_);
      drawVis();
      
      return lc;
    };
    
    lc.trendLength = function(_) {
      if (!arguments.length) return trendLength;
      
      trendLength = _;
      drawVis();
      
      return lc;
    };
    
    lc.zeroIntensity = function(_) {
      if (!arguments.length) return zeroIntensity;
      
      zeroIntensity = _;
      var v = zeroIntensity * 255;
      colorScale.range()[1] = d3.rgb(v, v, v);
      drawVis();
      
      return lc;
    };
    
    lc.showArea = function(_) {
      if (!arguments.length) return showArea;
      
      showArea = _;
      drawVis();
      
      return lc;
    };
    
    lc.showTrend = function(_) {
      if (!arguments.length) return showTrend;
      
      showTrend = _;
      drawVis();
      
      return lc;
    };
    
    lc.clipArea = function(_) {
      if (!arguments.length) return clipArea;
      
      clipArea = _;
      drawVis();
      
      return lc;
    };
    
    // Return the closure, with bound events
    return d3.rebind(lc, event, "on");
  };
})();