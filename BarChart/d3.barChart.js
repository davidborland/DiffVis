/*=========================================================================
 
 Name:        d3.barChart.js
 
 Author:      David Borland, The Renaissance Computing Institute (RENCI)
 
 Copyright:   The Renaissance Computing Institute (RENCI)
 
 Description: Bar chart with differential visualization using d3 following the 
              reusable charts convention: http://bost.ocks.org/mike/chart/
 
 =========================================================================*/

(function() {
  d3.barChart = function() {
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
        
        // Scales
        xScale = d3.scale.ordinal(),
        yScale = d3.scale.linear(), 
        diffScale = d3.scale.linear(),
        colorScale = d3.scale.linear()
            .range(["#0571b0", "#d1e5f0", "grey", "#fddbc7", "#ca0020"]),
        red = "#ca0020",
        blue = "#0571b0",
        matrixScale = d3.scale.ordinal(),
        cellScale = d3.scale.linear(),
            
        // Axes
        xAxis = d3.svg.axis()
            .scale(xScale)
            .orient("bottom"),
        yAxis = d3.svg.axis()
            .scale(yScale)
            .orient("left"),
        diffAxis = d3.svg.axis()
            .scale(diffScale)
            .orient("right")
            .ticks(5),
      
        // Parameters
        showBaseline = false,
        differenceMethod = "none",
        comboWidth = 1.0,

        // State
        baseline = null,
        
        // Start with empty selections
        svg = d3.select(),
        g = d3.select();

    // Create a closure containing the above variables
    function bc(selection) {
      selection.each(function(d) {  
        data = d;
        
//        data.sort(function(a, b) { return d3.descending(a.y, b.y); });
        
        // Select the svg element, if it exists
        svg = d3.select(this).selectAll("svg")
            .data([data]);
  
        // Otherwise create the skeletal chart
        var svgEnter = svg.enter().append("svg")
            .attr("class", "barChart")
            .on("mousedown", function() {
              // Stop text highlighting
              d3.event.preventDefault();
            });
            
        // Add defs for gradients
        //svgEnter.append("defs");
            
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
        g.append("g").attr("class", "bar");     
        g.append("g").attr("class", "baseline");
        g.append("g").attr("class", "axis");
        g.append("g").attr("class", "matrix");
        
        // Set domains for x and y scales
        xScale.domain(data.map(function(d) { return d.x; }));         
        yScale.domain([0, d3.max(data, function(d) { return d.y; })]);
        matrixScale.domain(data.map(function(d) { return d.x; }));
            
        // Set width and height
        setWidth(width);
        setHeight(height); 
        
        // Draw
        drawVis();                        
      });
    }
    
    function reset() {
      // Reset baseline
      baseline = null;

      // Redraw
      drawVis();

      // Clear highlight
      g.select(".bar").selectAll(".value")
          .classed("select", false);
    }
        
    function drawVis(transitionTime) {        
      if (transitionTime === undefined) transitionTime = 500;
      
      updateDifference();
      drawBars();
      drawBaseline();
      drawAxes();
      drawMatrix();
      
      function updateDifference() { 
        // Reset y scale domain, in case previously using bars difference method
        yScale.domain([0, d3.max(data, function(d) { return d.y; })]);              
        
        if (differenceMethod.indexOf("Map") !== -1) {
          // Set color domain based on difference range
          var range = d3.extent(data, function(d) { return d.y; });
          range = range[1] - range[0];
          
          colorScale.domain([-range, -0.1, 0, 0.1, range]);
          cellScale.domain([0, range]);
        }
        else if (baseline) {
          // Compute some difference information for this baseline
          var diffs = data.map(function(d) { return d.y - baseline; }),
              maxDiff = d3.max(diffs),
              minDiff = d3.min(diffs),
              maxAbs = d3.max(diffs, function(d) { return Math.abs(d); });

          if (differenceMethod === "bars") {
            // Change y scale to use difference
            yScale.domain([minDiff, maxDiff]);
          }
          else if (differenceMethod === "color") {              
            // Set color domain based on difference
            colorScale.domain([-maxAbs, -0.1, 0, 0.1, maxAbs]);
          }
          else if (differenceMethod === "combo") {
            // Set difference scale
            diffScale.domain([minDiff, maxDiff]);
            
            // Match tick spacing
            if (yScale.ticks().length > 1) {
              var spacing = yScale.ticks()[1] - yScale.ticks()[0],
                  ticks = d3.range(0, minDiff - 1, -spacing).concat(d3.range(spacing, maxDiff + 1, spacing));
              
              diffAxis.tickValues(ticks);
            }
          }
        }
      }
      
      function drawBars() {
        // Bind data
        var bar = g.select(".bar").selectAll(".bar > g")
            .data(differenceMethod.indexOf("Map") === -1 ? data : []);
          
        // Enter
        bar.enter().append("g")
            .on("mouseover", function() {    
              // Highlight
              d3.select(this).select(".value")
                  .classed("highlight", true);
            })
            .on("mouseout", function() {
              // Highlight
              d3.select(this).select(".value")
                  .classed("highlight", false);
            })
            .on("click", function(d, i) {
              var selected = d3.select(this).select(".value").classed("select");
            
              if (selected) {
                reset();
              }
              else {
                // Set baseline
                baseline = d.y;

                // Redraw
                drawVis();

                // Select
                g.select(".bar").selectAll(".value")
                    .classed("select", function(d, j) { return i === j; });
              }
            });
          
        // Enter + update
        bar.call(drawBar);
          
        // Exit
        bar.exit().remove();
        
        function drawBar(selection) {
          // Move bar in x
          selection.attr("transform", function(d) { return "translate(" + xScale(d.x) + ",0)"; });
          
          // Draw values, and difference combos
          drawValues();
          drawDifferenceCombo();
          
          function drawValues() {             
            // Bind value data
            var value = selection.selectAll(".value")
                .data(function(d) { return [d]; });

            // Enter
            value.enter().append("rect")
                .attr("class", "value");

            // Enter + update
            value.transition()
                .duration(transitionTime)
                .call(drawValue);

            // Exit
            value.exit().remove(); 
      
            function drawValue(selection) {
              selection                
                  .attr("y", y)
                  .attr("width", xScale.rangeBand())
                  .attr("height", height)
                  .style("fill", fill);          
                  
              function y(d) {
                // Return y depending on difference method and baseline
                if (differenceMethod === "bars" && baseline) {                  
                  return d.y > baseline ? yScale(d.y - baseline) : yScale(0);
                }
                else {
                  return yScale(d.y);
                }
              }
              
              function height(d) {
                // Return height depending on difference method and baseline
                if (differenceMethod === "bars" && baseline) {
                  return Math.abs(yScale(d.y) - yScale(baseline));
                } 
                else {
                  return innerHeight() - yScale(d.y);
                }
              }
              
              function fill(d) { 
                // Return color if using color difference method and there is a valid baseline
                if (differenceMethod === "color" && baseline && d.y !== baseline) {
                  //return d.y > baseline ? red : blue;
                  return colorScale(d.y - baseline);
                }
                else {
                  return null;
                }
              }
            } 
          }
          
          function drawDifferenceCombo() {
            // Bind data for difference combo
            var difference = selection.selectAll(".difference")
                .data(function(d) { return differenceMethod === "combo" && baseline ? [d] : []; });

            // Enter
            difference.enter().append("rect")
                .attr("class", "difference")
                .call(drawDifference);

            // Enter + update
            difference.transition()
                .duration(transitionTime)
                .call(drawDifference);

            difference.exit().remove();         

            function drawDifference(selection) {
              var strokeWidth = 2;

              selection       
                  .attr("x", strokeWidth / 2 + (xScale.rangeBand() - strokeWidth) * (1 - comboWidth) / 2)
                  .attr("y", function(d) { return d.y > baseline ? yScale(d.y) + strokeWidth / 2 : yScale(baseline) + strokeWidth / 2; })
                  .attr("width", (xScale.rangeBand() - strokeWidth) * comboWidth)
                  .attr("height", function(d) { return Math.max(Math.abs(yScale(d.y) - yScale(baseline)) - strokeWidth, 0); })
                  .style("fill", function(d) { return d.y > baseline ? red : blue; })
                  .style("fill-opacity", 0.1)
                  .style("stroke", function(d) { return d.y > baseline ? red : blue; })
                  .style("stroke-width", strokeWidth);
            }   
          }
        }
      }
      
      function drawBaseline() {
        // Add baseline
        var line = g.select(".baseline").selectAll(".baseline > line")
            .data(showBaseline && baseline && differenceMethod.indexOf("Map") === -1 ? 
                  differenceMethod === "bars" ? [0] : [baseline] : []);
    
        // Enter
        line.enter().append("line");
        
        // Enter + update
        line.transition()
            .duration(transitionTime)
            .call(drawLine);
        
        // Exit
        line.exit().remove();
        
        function drawLine(selection) {
          selection
              .attr("x1", 0)
              .attr("y1", function(d) { return yScale(d); })
              .attr("x2", innerWidth())
              .attr("y2", function(d) { return yScale(d); });
        }
      }
      
      function drawAxes() {        
        var axis = g.select(".axis");                    
        
        // Draw x axis
        var gXAxis = axis.selectAll(".xAxis")
            .data(differenceMethod.indexOf("Map") === -1 ? [0] : []);
          
        // Enter
        gXAxis.enter().append("g")
            .attr("class", "xAxis")
            .call(x);
        
        // Enter + update
        gXAxis.transition()
            .duration(transitionTime)
            .call(x);
          
        // Exit
        gXAxis.exit().remove();
/*          
        // Draw x label
        var xLabel = axis.selectAll(".xLabel")
            .data([0]);
          
        // Enter
        xLabel.enter().append("text")
            .attr("class", "xLabel")
            .call(xLab);
          
        // Enter + update
        xLabel.transition()
            .duration(transitionTime)
            .ease("linear")
            .call(xLab);
*/
        // Draw y axis
        var gYAxis = axis.selectAll(".yAxis")
            .data(differenceMethod.indexOf("Map") === -1 ? [0] : []);
          
        // Enter
        gYAxis.enter().append("g")
            .attr("class", "yAxis")
            .call(yAxis);
        
        // Enter + update
        gYAxis.transition()
            .duration(transitionTime)
            .call(yAxis);
          
        // Exit
        gYAxis.exit().remove();
/*          
        // Draw y label
        var yLabel = axis.selectAll(".yLabel")
            .data([0]);
          
        // Enter
        yLabel.enter().append("text")
            .attr("class", "yLabel")
            .call(yLab);
          
        // Enter + update
        yLabel.transition()
            .duration(transitionTime)
            .ease("linear")
            .call(yLab);
*/          

        // Draw difference axis
        var gDiffAxis = axis.selectAll(".diffAxis")
            .data(differenceMethod === "combo" && baseline ? [0] : []);
          
        // Enter
        gDiffAxis.enter().append("g")
            .attr("class", "diffAxis")
            .call(diff);
        
        // Enter + update
        gDiffAxis.transition()
            .duration(transitionTime)
            .call(diff);
        
        // Exit
        gDiffAxis.exit().remove();

        function x(selection) {
          selection
              .attr("transform", "translate(0," + innerHeight() + ")")
              .call(xAxis);
        }
        
        function diff(selection) {
          selection
              .attr("transform", "translate(" + innerWidth() + ",0)")
              .call(diffAxis);
        }
/*        
        function xLab(selection) {
          selection
              .text(xProperty)
              .attr("transform", "translate(" + (innerWidth() / 2) + "," + (innerHeight() + 40) + ")")
        }
        
        function yLab(selection) {
          selection
              .text(yProperty)
              .attr("transform", "translate(-35," + (innerHeight() / 2) + ")rotate(-90)");
        }
*/        
      }
      
      function drawMatrix() {       
        // Bind data for rows
        var row = g.select(".matrix").selectAll(".matrix > g")
            .data(differenceMethod.indexOf("Map") !== -1 ? data : []);
          
        // Enter
        row.enter().append("g");
        
        // Enter + update
        row.call(drawRow);
        
        // Exit
        row.exit().remove();
          
          
        function drawRow(selection) {
          // Move bar in y
          selection.attr("transform", function(d) { return "translate(0," + matrixScale(d.x) + ")"; });                            
          
          // Bind data for cells
          var cell = selection.selectAll(".cell") 
              .data(function(d) { return data.map(function(e) { return { row: d, column: e }; }) });
            
          // Enter
          cell.enter().append("rect")
              .attr("class", "cell")
              .call(drawCell);
          
          // Enter + update
          cell.transition()            
              .duration(transitionTime)
              .call(drawCell);
          
          // Exit
          cell.exit().remove();
          
          // Bind data for grid
          var grid = selection.selectAll(".grid")
              .data(data);
            
          // Enter
          grid.enter().append("rect")
              .attr("class", "grid")
              .call(drawGrid);
          
          // Enter + update
          grid.transition()
              .duration(transitionTime)
              .call(drawGrid);
          
          // Exit
          grid.exit().remove();
          
          function drawCell(selection) {      
            selection
                .attr("transform", function(d) { return "translate(" + matrixScale(d.column.x) + ",0)"; })
                .attr("x", x)
                .attr("y", y)
                .attr("width", width)
                .attr("height", height)
                .style("fill", fill);
              
            function x(d) {
              return differenceMethod === "sizeMap" ? (cellScale.range()[1] - width(d)) / 2 : 0;
            }
            
            function y(d) {
              return differenceMethod === "sizeMap" ? (cellScale.range()[1] - height(d)) / 2 : 
                     differenceMethod === "heightMap" ? cellScale.range()[1] - height(d) : 0;
            }
            
            function width(d) {
              return differenceMethod === "sizeMap" ? cellScale(mag(d)) : 
                     matrixScale.rangeBand();
            }
            
            function height(d) {
              return differenceMethod === "sizeMap" || differenceMethod === "heightMap" ? cellScale(mag(d)) : 
                     matrixScale.rangeBand();
            }
            
            function fill(d) {
              return differenceMethod === "sizeMap" || differenceMethod === "heightMap" ? d.column.y > d.row.y ? red : blue : colorScale(diff(d));
            }           
            
            function diff(d) {
              return d.column.y - d.row.y;
            }
            
            function mag(d) {
              return Math.abs(diff(d));
            }
          }
          
          function drawGrid(selection) {
            selection
                .attr("transform", function(d) { return "translate(" + matrixScale(d.x) + ",0)"; })
                .attr("width", matrixScale.rangeBand())
                .attr("height", matrixScale.rangeBand())
                .style("fill", "none")
                .style("stroke", differenceMethod === "sizeMap" ? "#ddd" : 
                                 differenceMethod === "heightMap" ? "#eee" :
                                 "dimgrey");
          }
        }
      }
    }
    
    function setWidth(_) {
      width = _;
      
      // Set svg width
      svg.attr("width", Math.max(width, height));      
      
      // Set x scale
      xScale.rangeRoundBands([0, innerWidth()], 0.2, 0.4);
      matrixScale.rangeRoundBands([0, Math.max(innerWidth(), innerHeight())]);
      cellScale.range([0, matrixScale.rangeBand()]);
    }
    
    function setHeight(_) {      
      height = _;
      
      // Set svg height
      svg.attr("height", Math.max(width, height));

      // Set y scales
      yScale.range([innerHeight(), 0]);
      diffScale.range([yScale(d3.min(data, function(d) { return d.y; })), 0]);
      matrixScale.rangeRoundBands([0, Math.max(innerWidth(), innerHeight())]);
      cellScale.range([0, matrixScale.rangeBand()]);
    }
    
    // Getters/setters
    
    bc.width = function(_) {
      if (!arguments.length) return width;
      
      setWidth(_);
      drawVis();
      
      return bc;
    };
    
    bc.height = function(_) {
      if (!arguments.length) return height;
      
      setHeight(_);
      drawVis();
      
      return bc;
    };
    
    bc.showBaseline = function(_) {
      if (!arguments.length) return showBaseline;
      
      showBaseline = _;      
      drawVis();
      
      return bc;
    };
    
    bc.differenceMethod = function(_) {
      if (!arguments.length) return differenceMethod;
      
      differenceMethod = _;
      drawVis();
      
      return bc;
    };
    
    bc.comboWidth = function(_) {
      if (!arguments.length) return comboWidth;
      
      comboWidth = _;
      drawVis(0);
      
      return bc;
    };
    
    // Return the closure, with bound events
    return d3.rebind(bc, event, "on");
  };
})();