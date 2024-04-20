var app = new Vue({
  el: '#app',
  data: {
    selectedTab: 'Materials', // Default selected tab
    concrete: {
      title: 'Concrete',
      inputs: {
        'fc': {
          value: '25',
          description: "Resistencia a compresión f'c (MPa):"
        },
        'e0': {
          value: '0.0022',
          description: "Deformación para compresión máxima (m/m):"
        },
        'eu': {
          value: '0.006',
          description: "Deformación última (m/m):"
        }
      }
    },
    steel: {
      title: 'Steel',
      inputs: {
        'Fy': {
          value: '420',
          description: "Tensión de fluencia Fy (MPa):"
        },
        'esh': {
          value: '0.01',
          description: "Deformación previa al endurecimiento esh (m/m):"
        },
        'esu': {
          value: '0.09',
          description: "Deformación para tensión máxima (m/m):"
        },
        'eu': {
          value: '0.2',
          description: "Deformación última (m/m):"
        },
      }
    },
    input: {
      id: 0,
      x1: '',
      x2: '',
      thickness: '',
      x: '',
      area: '',
    },
    section: {
      steel_areas: [{ 'id':0, 'x': 4, 'area': 5 }],
      concrete_segments: [{ 'id':1, 'x1': 0, 'x2': 100, 'thickness': 20, 'area':100*20}],
    },
    analysis: {
      data: [],
    },
    results: {
    },
    axial_load: -0.1,
    curvature: 0,
  },
  methods: {
    concrete_tension(epsilon) {
      var fc = parseFloat(this.concrete.inputs.fc.value)
      var e0 = parseFloat(this.concrete.inputs.e0.value)
      var eu = parseFloat(this.concrete.inputs.eu.value)
      if (epsilon < 0 && epsilon > -e0) {
        return -(2 * (Math.abs(epsilon) / e0) - (Math.abs(epsilon) / e0) ** 2) * fc;
      } else if (epsilon <= -e0 && epsilon >= -eu) {
        return -(1 - 0.15 * ((Math.abs(epsilon) - e0) / (0.0038 - e0))) * fc;
      } else {
        return 0;
      }
    },
    steel_tension(epsilon) {
      var Fy = parseFloat(this.steel.inputs.Fy.value);
      var esh = parseFloat(this.steel.inputs.esh.value);
      var esu = parseFloat(this.steel.inputs.esu.value);
      var eu = parseFloat(this.steel.inputs.eu.value);
      var Esh = 200000 / 30;
      var Fsu = 1.5 * Fy;
      var p = Esh * (esu - esh) / (Fsu - Fy);
      var Es = 200000;
      if (Math.abs(epsilon) <= 0.0021) {
        return Es * epsilon
      } else if (Math.abs(epsilon) <= esh) {
        return Fy * Math.sign(epsilon)
      } else if (Math.abs(epsilon) > esh && Math.abs(epsilon) <= eu) {
        return (Fsu + (Fy - Fsu) * Math.abs((esu - Math.abs(epsilon)) / (esu - esh)) ** p) * Math.sign(epsilon)
      } else {
        return 0
      }
    },
    plotConcrete() {
      d3.select("#concrete-svg").html('')
      const svg = d3.select("#concrete-svg"),
        margin = { top: 20, right: 20, bottom: 30, left: 50 },
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom,
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      // Data generation
      const xData = d3.range(0, 0.01, 0.0005);
      const data = xData.map(x => ({ x, y: -this.concrete_tension(-x) }));
      // Scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([0, width]);
      const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.y)])
        .range([height, 0]);
      // Line generator
      const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));
      // Draw line
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#305BA1")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 3)
        .attr("d", line);
      // Add the X Axis with fewer ticks
      g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale).ticks(5)); // Adjust number of ticks here
      // Add the Y Axis
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(5));
      // X Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("ε (m/m)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("fc (MPa)");
    },
    plotSteel() {
      d3.select("#steel-svg").html('')
      const svg = d3.select("#steel-svg"),
        margin = { top: 20, right: 20, bottom: 30, left: 50 },
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom,
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      // Data generation
      const xData = d3.range(-0.3, 0.3, 0.0005);
      const data = xData.map(x => ({ x, y: this.steel_tension(x) }));
      // Scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([0, width]).nice();
      const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.y), d3.max(data, d => d.y)])
        .range([height, 0]).nice();
      // Line generator
      const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));
      // Draw line
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#305BA1")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 3)
        .attr("d", line);
      // Add the X Axis with fewer ticks
      g.append("g")
        .attr("transform", "translate(0," + height / 2 + ")")
        .call(d3.axisBottom(xScale).ticks(5)); // Adjust number of ticks here
      // Add the Y Axis
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(5));
      // X Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("ε (m/m)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("fs (MPa)");
    },
    add_steel() {
      this.input.id += 1
      this.section.steel_areas.push({
        'id': this.input.id,
        'x': this.input.x,
        'area': this.input.area,
      })
    },
    add_concrete() {
      this.input.id += 1
      this.section.concrete_segments.push({
        'id': this.input.id,
        'x1': this.input.x1,
        'x2': this.input.x2,
        'thickness': this.input.thickness,
        'area': Math.abs(this.input.x2 - this.input.x1) * this.input.thickness,
      })
    },
    delete_steel(id) {
      this.section.steel_areas = this.section.steel_areas.filter(item => item.id !== id)
    },
    delete_concrete(id) {
      this.section.concrete_segments = this.section.concrete_segments.filter(item => item.id !== id)
    },
    get_concrete_fibers() {
      var N = 100; // Number of tranches
      var concrete_fibers = [];
      this.section.concrete_segments.forEach(element => {
        let Li = Math.abs(element.x2 - element.x1);
        let xi = Math.min(element.x1, element.x2);
        let dL = Li / N;
        let dA = element.thickness * dL;
        var positions = [];
        for (let i = 0; i < N; i++) {
          positions.push(xi + dL / 2 + dL * i);
        }
        positions.forEach(position => {
          concrete_fibers.push({
            'x': position,
            'area': dA,
          })
        });
      });
      return concrete_fibers
    },
    calculate_xg() {
      var xg = 0;
      var total_concrete_area = 0;
      this.section.concrete_segments.forEach(element => {
        total_concrete_area += element.area;
      });
      this.section.concrete_segments.forEach(element => {
        xg += ((element.x2 + element.x1) / 2) * element.area / total_concrete_area;
      });
      return xg
    },
    calculate_moment_curvature(curvature) {
      concrete_fibers = this.get_concrete_fibers();
      var x = [
        ...this.section.concrete_segments.map(obj => obj.x2),
        ...this.section.concrete_segments.map(obj => obj.x1)
      ];
      var max_x = Math.max(...x);
      var min_x = Math.min(...x);
      var L = max_x - min_x;
      // Iteration
      var iterator = 0;
      var c_max = 1.5 * L;
      var c_min = 0.0001;
      var c = c_min;
      while (iterator < 1000) {
        iterator++;
        var ec = -curvature * c;
        var et = ec / c * (min_x - max_x + c);
        // Epsilons
        var concrete_epsilons = [];
        concrete_fibers.forEach(fiber => {
          concrete_epsilons.push(ec / c * (fiber.x - max_x + c))
        });
        var steel_epsilons = [];
        this.section.steel_areas.forEach(element => {
          steel_epsilons.push(ec / c * (element.x - max_x + c))
        });
        // Forces
        var concrete_results = [];
        for (let i = 0; i < concrete_epsilons.length; i++) {
          let fiber = concrete_fibers[i];
          let epsilon = concrete_epsilons[i];
          let tension = this.concrete_tension(epsilon);
          let force = tension * 100 * fiber.area / 10000;
          concrete_results.push({
            'position': fiber.x,
            'area': fiber.area,
            'epsilon': epsilon,
            'tension': tension,
            'force': force,
          })
        }
        var steel_results = [];
        for (let i = 0; i < steel_epsilons.length; i++) {
          let steel_area = this.section.steel_areas[i];
          let id = steel_area.id
          let epsilon = steel_epsilons[i];
          let tension = this.steel_tension(epsilon);
          let force = tension * 100 * steel_area.area / 10000;
          steel_results.push({
            'id': id,
            'position': steel_area.x,
            'area': steel_area.area,
            'epsilon': epsilon,
            'tension': tension,
            'force': force,
          })
        }
        // Equilibrium
        var Pn_concrete = 0;
        var Pn_steel = 0;
        var Mn_concrete = 0
        var Mn_steel = 0
        concrete_results.forEach(element => {
          Pn_concrete += element.force
          Mn_concrete += element.force * element.position
        });
        steel_results.forEach(element => {
          Pn_steel += element.force
          Mn_steel += element.force * element.position
        });
        var Pn = Pn_concrete + Pn_steel;
        var P = (this.axial_load == 0 ? -0.01 : this.axial_load);
        var P = (P == 0 ? -0.01 : this.axial_load);
        var xg = this.calculate_xg();
        var Mn = Math.abs(Mn_concrete + Mn_steel - P * xg / 2);
        // Verification
        if (Pn > P) {
          var error = Pn / P;
          var c0 = c;
          var c = (c_max + c) / 2;
          var c_min = c0;
        } else if (Pn < P) {
          var error = P / Pn;
          var c0 = c;
          var c = (c_min + c) / 2;
          var c_max = c0;
        } else if (Pn == P) {
          break;
        }
        if (error < 1.05 && error > 0.95) {
          break;
        }
      }
      var result = {
        'iterator': iterator,
        'curvature': curvature,
        'xg': xg,
        'Pn': Pn,
        'Mn': Mn,
        'c': c,
        'ec': ec,
        'et': et,
        'min_x': min_x,
        'max_x': max_x,
        'steel_results': steel_results,
        'concrete_results': concrete_results
      }
      return result
    },
    calcualte_interaction(P) {
      concrete_fibers = this.get_concrete_fibers();
      var x = [
        ...this.section.concrete_segments.map(obj => obj.x2),
        ...this.section.concrete_segments.map(obj => obj.x1)
      ];
      var max_x = Math.max(...x);
      var min_x = Math.min(...x);
      var L = max_x - min_x;
      // Iteration
      var iterator = 0;
      var c_max = 1.5 * L;
      var c_min = 0.0001;
      var c = c_min;
      while (iterator < 1000) {
        iterator++;
        var ec = -0.003;
        var et = ec / c * (min_x - max_x + c);
        // Epsilons
        var concrete_epsilons = [];
        concrete_fibers.forEach(fiber => {
          concrete_epsilons.push(ec / c * (fiber.x - max_x + c))
        });
        var steel_epsilons = [];
        this.section.steel_areas.forEach(element => {
          steel_epsilons.push(ec / c * (element.x - max_x + c))
        });
        // Forces
        var concrete_results = [];
        for (let i = 0; i < concrete_epsilons.length; i++) {
          let fiber = concrete_fibers[i];
          let epsilon = concrete_epsilons[i];
          let tension = this.concrete_tension(epsilon);
          let force = tension * 100 * fiber.area / 10000;
          concrete_results.push({
            'position': fiber.x,
            'area': fiber.area,
            'epsilon': epsilon,
            'tension': tension,
            'force': force,
          })
        }
        var steel_results = [];
        for (let i = 0; i < steel_epsilons.length; i++) {
          let steel_area = this.section.steel_areas[i];
          let id = steel_area.id
          let epsilon = steel_epsilons[i];
          let tension = this.steel_tension(epsilon);
          let force = tension * 100 * steel_area.area / 10000;
          steel_results.push({
            'id': id,
            'position': steel_area.x,
            'area': steel_area.area,
            'epsilon': epsilon,
            'tension': tension,
            'force': force,
          })
        }
        // Equilibrium
        var Pn_concrete = 0;
        var Pn_steel = 0;
        var Mn_concrete = 0
        var Mn_steel = 0
        concrete_results.forEach(element => {
          Pn_concrete += element.force
          Mn_concrete += element.force * element.position
        });
        steel_results.forEach(element => {
          Pn_steel += element.force
          Mn_steel += element.force * element.position
        });
        var Pn = Pn_concrete + Pn_steel;
        var P = (P == 0 ? -0.01 : P);
        var xg = this.calculate_xg();
        var Mn = Math.abs(Mn_concrete + Mn_steel - P * xg / 2);
        // Verification
        if (Pn > P) {
          var error = Pn / P;
          var c0 = c;
          var c = (c_max + c) / 2;
          var c_min = c0;
        } else if (Pn < P) {
          var error = P / Pn;
          var c0 = c;
          var c = (c_min + c) / 2;
          var c_max = c0;
        } else if (Pn == P) {
          break;
        }
        if (error < 1.05 && error > 0.95) {
          break;
        }
      }
      var result = {
        'iterator': iterator,
        'curvature': -ec / c,
        'xg': xg,
        'Pn': Pn,
        'Mn': Mn,
        'c': c,
        'ec': ec,
        'et': et,
        'min_x': min_x,
        'max_x': max_x,
        'steel_results': steel_results,
        'concrete_results': concrete_results
      }
      return result
    },
    update_moment_curvature_data() {
      this.analysis.data = [{ 'x': 0, 'y': 0 }];
      for (let i = 0; i < 100; i++) {
        curvature = (i + 1) / 100000;
        result = this.calculate_moment_curvature(curvature);
        this.analysis.data.push({ 'x': curvature, 'y': result.Mn / 100 })
      }
    },
    update_interaction_data() {
      var PnMax = 0;
      var SteelForce = 0;
      var ConcreteForce = 0;
      var PnMin = 0;
      

    },
    plot_section() {
      d3.select("#section-svg").remove()
      // Define the zoom behavior
      function handleZoom(e) {
        d3.select("#section-svg g").attr('transform', e.transform);
      }
      var zoom = d3.zoom().on('zoom', handleZoom);
      const svg = d3.select("#section-container")
        .append("svg")
        .attr("id", "section-svg")
        .attr("width", '100%')
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(zoom)
        .append("g")

      // Data generation
      this.section.concrete_segments.forEach(element => {
        // Draw the line
        svg.append('line')
          .attr('x1', element.x1)
          .attr('y1', element.thickness / 2)
          .attr('x2', element.x2)
          .attr('y2', element.thickness / 2)
          .attr('stroke', 'black')
          .attr('stroke-width', 2);
        // Draw the line
        svg.append('line')
          .attr('x1', element.x1)
          .attr('y1', -element.thickness / 2)
          .attr('x2', element.x2)
          .attr('y2', -element.thickness / 2)
          .attr('stroke', 'black')
          .attr('stroke-width', 2);
        // Draw the line
        svg.append('line')
          .attr('x1', element.x1)
          .attr('y1', element.thickness / 2)
          .attr('x2', element.x1)
          .attr('y2', -element.thickness / 2)
          .attr('stroke', 'black')
          .attr('stroke-width', 2);
        // Draw the line
        svg.append('line')
          .attr('x1', element.x2)
          .attr('y1', element.thickness / 2)
          .attr('x2', element.x2)
          .attr('y2', -element.thickness / 2)
          .attr('stroke', 'black')
          .attr('stroke-width', 2);
      });
      this.section.steel_areas.forEach(element => {
        svg.append('circle')
          .attr('cx', element.x)
          .attr('cy', 0)
          .attr('r', Math.sqrt(element.area / Math.PI))
          .attr('fill', 'black');
      });
    },
    plot_moment_curvature() {
      const data = this.analysis.data;
      d3.select("#moment-curvature-svg").html('')
      const svg = d3.select("#moment-curvature-svg"),
        margin = { top: 20, right: 20, bottom: 30, left: 50 },
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom,
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      // Scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([0, width])
        .nice();
      const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.y)])
        .range([height, 0])
        .nice();
      // Line generator
      const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));
      // Draw line
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#305BA1")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 3)
        .attr("d", line);
      // Add the X Axis with fewer ticks
      g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale).ticks(5)); // Adjust number of ticks here
      // Add the Y Axis
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(5));
      // X Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("Φ (m/m)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("Mn (tonf-m)");
    },
    plot_line() {
      const svg = d3.select("#moment-curvature-svg");
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };
      const width = +svg.attr("width") - margin.left - margin.right;
      const height = +svg.attr("height") - margin.top - margin.bottom;
      const g = svg.select("g");
      svg.select('#vertical-line').remove();
      svg.select('#vertical-line-text').remove();
      // Scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(this.analysis.data, d => d.x))
        .range([0, width])
        .nice();
      const yScale = d3.scaleLinear()
        .domain([0, d3.max(this.analysis.data, d => d.y)])
        .range([height, 0])
        .nice();
      g.append('line')
        .attr('id', 'vertical-line') // Adding an identifier
        .attr('x1', xScale(this.curvature / 100000))
        .attr('x2', xScale(this.curvature / 100000))
        .attr('y1', 3)
        .attr('y2', height)
        .attr('stroke', '#FFDC01')
        .attr('stroke-width', 3)
      // Values of Mn and Φ
      var Mn = this.results.Mn / 100
      var Cur = this.curvature / 100000
      g.append("text")
        .attr('id', 'vertical-line-text')
        .attr("text-anchor", "end")
        .attr("x", xScale(this.curvature / 100000) + 40)
        .attr("y", margin.top - 20)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "12px") // Change font-size here
        .text('(' + Cur.toFixed(5) + ', ' + Mn.toFixed(2) + ')');
    },
    plot_deformation_profile() {
      d3.select("#def-profile-svg").html('')
      const svg = d3.select("#def-profile-svg");
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };
      const width = +svg.attr("width") - margin.left - margin.right;
      const height = +svg.attr("height") - margin.top - margin.bottom;
      const g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      const data = [
        { 'x': this.results.min_x, 'y': 0 },
        { 'x': this.results.min_x, 'y': this.results.et },
        { 'x': this.results.max_x, 'y': this.results.ec },
        { 'x': this.results.max_x, 'y': 0 },
        { 'x': this.results.min_x, 'y': 0 },
      ];
      // Scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([0, width]);
      const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.y), d3.max(data, d => d.y)])
        .range([height, 0]).nice();
      // Line generator
      const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));
      // Draw line
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#305BA1")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 3)
        .attr("d", line);
      // Add the X Axis with fewer ticks
      g.append("g")
        .attr("transform", "translate(0," + yScale(0) + ")")
        .call(d3.axisBottom(xScale).ticks(5)); // Adjust number of ticks here
      // Add the Y Axis
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(3));
      // Values of ec, et & c
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", margin.top - 30)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "12px") // Change font-size here
        .text('εc = ' + this.results.ec.toFixed(5));
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", margin.top - 10)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "12px") // Change font-size here
        .text('c = ' + this.results.c.toFixed(2) + ' cm');
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", margin.top - 20)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "12px") // Change font-size here
        .text('εt = ' + this.results.et.toFixed(5));
      // X Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("ε (m/m)");
    },
    plot_concrete_profile() {
      d3.select("#concrete-profile-svg").html('')
      const svg = d3.select("#concrete-profile-svg");
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };
      const width = +svg.attr("width") - margin.left - margin.right;
      const height = +svg.attr("height") - margin.top - margin.bottom;
      const g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      var data = [];
      this.results.concrete_results.forEach(element => {
        data.push({
          'x': element.position,
          'y': element.tension,
        })
      });
      // Scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([0, width]).nice();
      const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.y), d3.max(data, d => d.y)])
        .range([height, 0]).nice();
      // Line generator
      const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));
      // Draw line
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#305BA1")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 3)
        .attr("d", line);
      // Add the X Axis with fewer ticks
      g.append("g")
        .attr("transform", "translate(0," + yScale(0) + ")")
        .call(d3.axisBottom(xScale).ticks(5)); // Adjust number of ticks here
      // Value of fc
      var max_fc = Math.min(...this.results.concrete_results.map(obj => obj.tension))
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + 20)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "12px") // Change font-size here
        .text('Max fc = ' + max_fc.toFixed(1) + ' MPa');
      // Add the X Axis
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(3));
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("fc (MPa)");
    },
    plot_steel_profile() {
      d3.select("#steel-profile-svg").html('')
      const svg = d3.select("#steel-profile-svg");
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };
      const width = +svg.attr("width") - margin.left - margin.right;
      const height = +svg.attr("height") - margin.top - margin.bottom;
      const g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      var data = [{ 'x': 0, 'y': 0 }];
      this.results.steel_results.forEach(element => {
        data.push({
          'x': element.position,
          'y': element.tension,
        })
      });
      // Scales
      const xScale = d3.scaleLinear()
        .domain([this.results.min_x, this.results.max_x])
        .range([0, width]).nice();
      const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.y), d3.max(data, d => d.y)])
        .range([height, 0]).nice();
      // Draw line
      data.forEach(element => {
        g.append('line')
          .attr('id', 'vertical-line') // Adding an identifier
          .attr('x1', xScale(element.x))
          .attr('x2', xScale(element.x))
          .attr('y1', yScale(0))
          .attr('y2', yScale(element.y))
          .attr('stroke', "#305BA1")
          .attr('stroke-width', 3)
      });
      // Add the X Axis with fewer ticks
      g.append("g")
        .attr("transform", "translate(0," + yScale(0) + ")")
        .call(d3.axisBottom(xScale).ticks(5)); // Adjust number of ticks here
      // Value of fs
      var max_fs = Math.max(...this.results.steel_results.map(obj => obj.tension))
      var min_fs = Math.min(...this.results.steel_results.map(obj => obj.tension))
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", 0)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "12px") // Change font-size here
        .text('Max fs = ' + max_fs.toFixed(1) + ' MPa');
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", 10)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "12px") // Change font-size here
        .text('Min fs = ' + min_fs.toFixed(1) + ' MPa');
      // Add the X Axis
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(3));
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("x (cm)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "14px") // Change font-size here
        .text("fs (MPa)");
    }
  },
  mounted() {
    this.plotSteel();
    this.plotConcrete();
    this.plot_section();
    this.update_moment_curvature_data();
    this.plot_moment_curvature();
  },
  watch: {
    steel: {
      handler() {
        this.update_moment_curvature_data();
        this.plotSteel();
        this.plot_moment_curvature();
      },
      deep: true
    },
    concrete: {
      handler() {
        this.update_moment_curvature_data();
        this.plotConcrete();
        this.plot_moment_curvature();
      },
      deep: true
    },
    section: {
      handler() {
        this.update_moment_curvature_data();
        this.plot_section();
        this.plot_moment_curvature();
      },
      deep: true
    },
    analysis: {
      handler() {
        this.plot_moment_curvature();
        this.results = this.calculate_moment_curvature(this.curvature / 100000);
        this.plot_line();
        this.plot_deformation_profile();
        this.plot_concrete_profile();
        this.plot_steel_profile();
      },
      deep: true
    },
    curvature: {
      handler() {
        this.results = this.calculate_moment_curvature(this.curvature / 100000);
        this.plot_deformation_profile();
        this.plot_concrete_profile();
        this.plot_steel_profile();
        this.plot_line();
      }
    },
    axial_load: {
      handler() {
        if (Math.abs(this.axial_load) >= 0.0000000001) {
          this.update_moment_curvature_data()
          this.results = this.calculate_moment_curvature(this.curvature / 100000);
        }
      }
    }
  }

});


