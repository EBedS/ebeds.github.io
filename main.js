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
      id: 5,
      x1: '',
      x2: '',
      thickness: '',
      x: '',
      area: '',
      Pu: '',
      Mu: '',
    },
    section: {
      steel_areas: [
        { 'id': 1, 'x': 4, 'area': 5 },
        { 'id': 2, 'x': 25, 'area': 5 },
        { 'id': 3, 'x': 50, 'area': 5 },
        { 'id': 4, 'x': 75, 'area': 5 },
        { 'id': 5, 'x': 96, 'area': 5 }
      ],
      concrete_segments: [{ 'id': 0, 'x1': 0, 'x2': 100, 'thickness': 20, 'area': 2000 }],
    },
    analysis: {
      data: [],
    },
    interaction: [

    ],
    results: {
    },
    axial_load: -0.1,
    curvature: 0,
    switchState: true,
    xg: 0,
    interaction_points: [],
    
    // Interactive Section Designer Properties
    designMode: 'concrete', // 'concrete', 'steel', 'pan'
    currentThickness: 20,
    currentSteelArea: 5,
    showGrid: true,
    snapToGrid: true,
    gridSize: 5,
    canvasWidth: 400, // Canvas width in cm
    showDesignerModal: false,
    
    // Designer state
    isDrawing: false,
    drawingStart: null,
    selectedElement: null,
    designerZoom: null,
    designerTransform: { x: 0, y: 0, k: 1 },
  },
  computed: {
    // Convert concrete segment coordinates to positive values for display
    displayConcreteSegments() {
      const halfWidth = this.canvasWidth / 2;
      return this.section.concrete_segments.map(segment => ({
        ...segment,
        x1: segment.x1 + halfWidth,
        x2: segment.x2 + halfWidth
      }));
    },
    // Convert steel coordinates to positive values for display
    displaySteelAreas() {
      const halfWidth = this.canvasWidth / 2;
      return this.section.steel_areas.map(steel => ({
        ...steel,
        x: steel.x + halfWidth
      }));
    },
    // Calculate maximum axial load based on concrete capacity
    maxAxialLoad() {
      const fc = parseFloat(this.concrete.inputs.fc.value) || 0;
      const concrete_fibers = this.get_concrete_fibers();
      let totalConcreteArea = 0;
      
      concrete_fibers.forEach(fiber => {
        totalConcreteArea += fiber.area;
      });
      
      // Convert area from mm² to cm² (divide by 100) and multiply by fc * 100
      // This gives the maximum compression capacity in tonf
      return (totalConcreteArea / 100) * fc * 100 / 1000; // Convert to tonf
    },
    // Check if steel areas exist
    hasSteelAreas() {
      return this.section.steel_areas && this.section.steel_areas.length > 0;
    }
  },
  methods: {
    toggleSwitch() {
      this.switchState = !this.switchState;
    },
    
    // Modal Management Methods
    openDesignerModal() {
      this.showDesignerModal = true;
      // Wait for DOM update then plot
      this.$nextTick(() => {
        this.plot_section_designer('#section-designer-modal-container', '#section-designer-modal-svg');
      });
    },
    
    closeDesignerModal() {
      this.showDesignerModal = false;
      // Update the compact designer
      this.plot_section_designer();
    },

    // Local Storage Methods
    saveSection() {
      try {
        const sectionData = {
          concrete_segments: this.section.concrete_segments,
          steel_areas: this.section.steel_areas,
          canvasWidth: this.canvasWidth,
          gridSize: this.gridSize,
          showGrid: this.showGrid,
          snapToGrid: this.snapToGrid,
          currentThickness: this.currentThickness,
          currentSteelArea: this.currentSteelArea,
          designMode: this.designMode
        };
        localStorage.setItem('miniSectionDesigner', JSON.stringify(sectionData));
        console.log('Section saved to localStorage');
      } catch (error) {
        console.error('Error saving section:', error);
      }
    },

    loadSection() {
      try {
        const savedData = localStorage.getItem('miniSectionDesigner');
        if (savedData) {
          const sectionData = JSON.parse(savedData);
          
          // Restore section data
          this.section.concrete_segments = sectionData.concrete_segments || [];
          this.section.steel_areas = sectionData.steel_areas || [];
          
          // Restore UI settings
          if (sectionData.canvasWidth) this.canvasWidth = sectionData.canvasWidth;
          if (sectionData.gridSize) this.gridSize = sectionData.gridSize;
          if (sectionData.showGrid !== undefined) this.showGrid = sectionData.showGrid;
          if (sectionData.snapToGrid !== undefined) this.snapToGrid = sectionData.snapToGrid;
          if (sectionData.currentThickness) this.currentThickness = sectionData.currentThickness;
          if (sectionData.currentSteelArea) this.currentSteelArea = sectionData.currentSteelArea;
          if (sectionData.designMode) this.designMode = sectionData.designMode;
          
          console.log('Section loaded from localStorage');
          
          // Refresh the display
          this.$nextTick(() => {
            this.plot_section_designer();
          });
        }
      } catch (error) {
        console.error('Error loading section:', error);
      }
    },

    clearSavedSection() {
      try {
        localStorage.removeItem('miniSectionDesigner');
        console.log('Saved section cleared');
      } catch (error) {
        console.error('Error clearing saved section:', error);
      }
    },
    
    // Interactive Section Designer Methods
    setDesignMode(mode) {
      this.designMode = mode;
      this.selectedElement = null;
      this.update_designer_cursor();
      
      // Re-initialize interactions when mode changes
      this.plot_section_designer();
      
      // Also update modal if it's open
      if (this.showDesignerModal) {
        this.update_designer_cursor('#section-designer-modal-svg');
        this.plot_section_designer('#section-designer-modal-container', '#section-designer-modal-svg');
      }
    },
    
    update_designer_cursor(svgSelector = "#section-designer-svg") {
      const svg = d3.select(svgSelector);
      svg.classed("pan-mode", this.designMode === 'pan');
    },

    snapToGridValue(value) {
      if (!this.snapToGrid || !this.gridSize || this.gridSize <= 0) return value;
      return Math.round(value / this.gridSize) * this.gridSize;
    },
    
    clearSection() {
      this.section.concrete_segments = [];
      this.section.steel_areas = [];
      this.selectedElement = null;
      this.plot_section_designer();
      if (this.showDesignerModal) {
        this.plot_section_designer('#section-designer-modal-container', '#section-designer-modal-svg');
      }
    },
    
    resetView() {
      this.designerTransform = { x: 0, y: 0, k: 1 };
      this.plot_section_designer();
      if (this.showDesignerModal) {
        this.plot_section_designer('#section-designer-modal-container', '#section-designer-modal-svg');
      }
    },
    
    // Convert screen coordinates to section coordinates
    screenToSection(screenX, screenY, svgSelector = "#section-designer-svg") {
      const svgNode = d3.select(svgSelector).node();
      const svgRect = svgNode.getBoundingClientRect();
      const halfWidth = this.canvasWidth / 2;
      
      // Convert to SVG coordinates (accounting for dynamic canvas width)
      let x = ((screenX - svgRect.left) / svgRect.width) * this.canvasWidth - halfWidth; // Dynamic range based on canvas width
      let y = -((screenY - svgRect.top) / svgRect.height) * 100 + 50; // -50 to 50 range
      
      // Apply inverse transform if transform exists
      if (this.designerTransform && this.designerTransform.k !== 1) {
        x = (x - this.designerTransform.x) / this.designerTransform.k;
        y = (y - this.designerTransform.y) / this.designerTransform.k;
      }
      
      return { 
        x: this.snapToGridValue(x), 
        y: this.snapToGridValue(y) 
      };
    },
    
    plot_section_designer(containerSelector = "#section-designer-container", svgSelector = "#section-designer-svg") {
      d3.select(svgSelector).remove();
      
      const container = d3.select(containerSelector);
      const halfWidth = this.canvasWidth / 2;
      
      // Calculate scale factor to keep font sizes consistent
      const baseCanvasWidth = 500; // Reference width for font scaling
      const fontScale = Math.max(0.5, Math.min(2, this.canvasWidth / baseCanvasWidth)); // Limit scale between 0.5x and 2x
      
      const svg = container.append("svg")
        .attr("id", svgSelector.substring(1)) // Remove # from selector
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `${-halfWidth} -50 ${this.canvasWidth} 100`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("data-font-scale", fontScale); // Store font scale for use by text elements
      
      // Create main group for all content that can be zoomed/panned
      const mainGroup = svg.append("g")
        .attr("class", "main-group");
      
      // Apply existing transform if any
      if (this.designerTransform) {
        mainGroup.attr("transform", this.designerTransform);
      }
      
      // Define and apply zoom behavior only in pan mode
      const self = this;
      if (this.designMode === 'pan') {
        const zoom = d3.zoom()
          .scaleExtent([0.1, 10])
          .on('zoom', function(event) {
            mainGroup.attr('transform', event.transform);
            self.designerTransform = event.transform;
          });
        
        svg.call(zoom);
        this.designerZoom = zoom;
      } else {
        // Remove zoom behavior in drawing modes
        svg.on('.zoom', null);
        this.designerZoom = null;
      }
      
      // Add background
      mainGroup.append("rect")
        .attr("x", -halfWidth)
        .attr("y", -50)
        .attr("width", this.canvasWidth)
        .attr("height", 100)
        .attr("fill", "white")
        .attr("stroke", "none");
      
      // Draw grid if enabled (behind concrete)
      if (this.showGrid) {
        this.drawGrid(mainGroup);
      }
      
      // Draw concrete segments AFTER grid (in front of grid)
      this.section.concrete_segments.forEach(element => {
        this.drawConcreteSegment(mainGroup, element);
      });
      
      // Draw steel areas LAST (in front of everything)
      this.section.steel_areas.forEach(element => {
        this.drawSteelArea(mainGroup, element);
      });
      
      // Add interaction handlers
      this.addDesignerInteractions(svg, mainGroup, svgSelector);
      
      this.update_designer_cursor(svgSelector);
    },
    
    drawGrid(svg) {
      // Validate gridSize to prevent crashes
      if (!this.gridSize || this.gridSize <= 0 || this.gridSize > 100) {
        return; // Skip drawing grid if invalid size
      }
      
      const gridGroup = svg.append("g").attr("class", "grid");
      const halfWidth = this.canvasWidth / 2;
      
      // Vertical lines
      for (let x = -halfWidth; x <= halfWidth; x += this.gridSize) {
        gridGroup.append("line")
          .attr("x1", x)
          .attr("y1", -50)
          .attr("x2", x)
          .attr("y2", 50)
          .attr("class", x % (this.gridSize * 4) === 0 ? "grid-line major" : "grid-line");
      }
      
      // Horizontal lines
      for (let y = -50; y <= 50; y += this.gridSize) {
        gridGroup.append("line")
          .attr("x1", -halfWidth)
          .attr("y1", y)
          .attr("x2", halfWidth)
          .attr("y2", y)
          .attr("class", y % (this.gridSize * 4) === 0 ? "grid-line major" : "grid-line");
      }
      
      // Add positive coordinate reference marks at major grid lines
      for (let x = -halfWidth; x <= halfWidth; x += this.gridSize * 4) {
        const userX = x + halfWidth; // Convert to positive coordinate
        if (userX % (this.gridSize * 4) === 0) {
          gridGroup.append("text")
            .attr("x", x)
            .attr("y", -35)
            .attr("text-anchor", "middle")
            .attr("font-size", "8")
            .attr("fill", "#666")
            .text(userX.toFixed(0));
        }
      }
    },
    
    drawConcreteSegment(svg, element) {
      const group = svg.append("g").attr("class", "concrete-element");
      const length = Math.abs(element.x2 - element.x1);
      
      // Draw rectangle - NON-SELECTABLE (no click events)
      group.append("rect")
        .attr("x", Math.min(element.x1, element.x2))
        .attr("y", -element.thickness / 2)
        .attr("width", Math.abs(element.x2 - element.x1))
        .attr("height", element.thickness)
        .attr("class", "concrete-segment")
        .attr("data-id", element.id)
        .style("pointer-events", "none") // Make non-selectable
        .on("mouseenter", function() {
          // Show length tooltip on hover
          const centerX = (element.x1 + element.x2) / 2;
          const y = -element.thickness / 2 - 15;
          
          const tooltip = svg.append("g").attr("class", "length-tooltip");
          
          const text = tooltip.append("text")
            .attr("x", centerX)
            .attr("y", y)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", "8")
            .attr("font-weight", "bold")
            .attr("fill", "#FFD700")
            .text(`L: ${length.toFixed(1)} cm`);
          
          const bbox = text.node().getBBox();
          tooltip.insert("rect", "text")
            .attr("x", bbox.x - 2)
            .attr("y", bbox.y - 1)
            .attr("width", bbox.width + 4)
            .attr("height", bbox.height + 2)
            .attr("fill", "white")
            .attr("stroke", "#FFD700")
            .attr("stroke-width", 1)
            .attr("rx", 2)
            .attr("opacity", 0.9);
        })
        .on("mouseleave", function() {
          svg.select(".length-tooltip").remove();
        });
      
      // Add label for thickness and length - positioned above the concrete section
      const centerX = (element.x1 + element.x2) / 2;
      const segmentLength = Math.abs(element.x2 - element.x1);
      group.append("text")
        .attr("x", centerX)
        .attr("y", -element.thickness / 2 - 3)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("font-size", "8")
        .attr("fill", "#333")
        .style("pointer-events", "none") // Make text non-selectable
        .text(`e=${element.thickness}cm, L=${segmentLength.toFixed(1)}cm`);
    },
    
    drawSteelArea(svg, element) {
      const radius = Math.sqrt(element.area / Math.PI);
      
      const group = svg.append("g").attr("class", "steel-element");
      
      group.append("circle")
        .attr("cx", element.x)
        .attr("cy", 0)
        .attr("r", radius)
        .attr("class", "steel-area")
        .attr("data-id", element.id);
      
      // Add label
      group.append("text")
        .attr("x", element.x)
        .attr("y", radius + 8)
        .attr("text-anchor", "middle")
        .attr("font-size", "8")
        .attr("fill", "#333")
        .text(`${element.area}cm²`);
    },
    
    addDesignerInteractions(svg, mainGroup, svgSelector = "#section-designer-svg") {
      const self = this;
      
      // Only add drawing interactions if not in pan mode
      if (this.designMode !== 'pan') {
        svg.on("mousedown", function(event) {
          event.preventDefault();
          const coords = self.screenToSection(event.clientX, event.clientY, svgSelector);
          
          if (self.designMode === 'concrete') {
            self.startDrawingConcrete(coords, svgSelector);
          } else if (self.designMode === 'steel') {
            self.addSteelAtPosition(coords, svgSelector);
          }
        });
        
        svg.on("mousemove", function(event) {
          const coords = self.screenToSection(event.clientX, event.clientY, svgSelector);
          
          if (self.isDrawing && self.designMode === 'concrete') {
            self.updateDrawingPreview(coords, svgSelector);
          } else {
            // Show dynamic dimension lines for precise placement
            self.showDynamicDimensions(coords, svgSelector);
          }
        });
        
        svg.on("mouseup", function(event) {
          if (self.isDrawing && self.designMode === 'concrete') {
            const coords = self.screenToSection(event.clientX, event.clientY, svgSelector);
            self.finishDrawingConcrete(coords, svgSelector);
          }
        });
        
        // Remove dimension lines when mouse leaves the SVG
        svg.on("mouseleave", function() {
          self.hideDynamicDimensions(svgSelector);
        });
      } else {
        // Clear drawing event handlers in pan mode
        svg.on("mousedown", null);
        svg.on("mousemove", null);
        svg.on("mouseup", null);
        svg.on("mouseleave", null);
        self.hideDynamicDimensions(svgSelector);
      }
      
      // Handle element selection and deletion (only for concrete segments)
      mainGroup.selectAll(".concrete-segment")
        .on("click", function(event) {
          event.stopPropagation();
          const elementId = parseInt(d3.select(this).attr("data-id"));
          const isSteel = false; // Only concrete segments are selectable
          
          if (self.designMode === 'pan') {
            self.selectElement(elementId, isSteel);
          }
        });
    },
    
    startDrawingConcrete(coords, svgSelector = "#section-designer-svg") {
      this.isDrawing = true;
      this.drawingStart = coords;
      
      // Add preview rectangle to main group
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      mainGroup.append("rect")
        .attr("class", "drawing-preview")
        .attr("x", coords.x)
        .attr("y", -this.currentThickness / 2)
        .attr("width", 0)
        .attr("height", this.currentThickness);
      
      // Show initial length indicator (0 cm)
      this.updateLengthIndicator(mainGroup, coords.x, 0, 0);
      
      // Add reference lines for alignment
      this.showReferenceLines(coords, svgSelector);
    },
    
    updateDrawingPreview(coords, svgSelector = "#section-designer-svg") {
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      const preview = mainGroup.select(".drawing-preview");
      
      if (!preview.empty()) {
        const width = coords.x - this.drawingStart.x;
        const x = width >= 0 ? this.drawingStart.x : coords.x;
        const length = Math.abs(width);
        
        preview
          .attr("x", x)
          .attr("width", Math.abs(width));
        
        // Update or create length indicator
        this.updateLengthIndicator(mainGroup, x, Math.abs(width), length);
        
        // Update reference lines
        this.updateReferenceLines(coords, svgSelector);
      }
    },
    
    updateLengthIndicator(svg, x, width, length) {
      // Remove existing length indicator
      svg.select(".length-indicator").remove();
      
      if (this.isDrawing || width > 0) { // Show during drawing or if there's width
        const centerX = x + width / 2;
        const y = -this.currentThickness / 2 - 8; // Position above the preview
        
        // Create group for length indicator
        const indicator = svg.append("g").attr("class", "length-indicator");
        
        // Show only length, not coordinates or area
        let textContent = `${length.toFixed(1)} cm`;
        
        // Background rectangle for text
        const textElement = indicator.append("text")
          .attr("x", centerX)
          .attr("y", y)
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("font-size", "8") // Better readable size
          .attr("font-weight", "bold")
          .attr("fill", "#FFD700")
          .text(textContent);
        
        // Get text dimensions for background
        const bbox = textElement.node().getBBox();
        
        // Add background rectangle
        indicator.insert("rect", "text")
          .attr("x", bbox.x - 2)
          .attr("y", bbox.y - 1)
          .attr("width", bbox.width + 4)
          .attr("height", bbox.height + 2)
          .attr("fill", "rgba(255, 255, 255, 0.95)")
          .attr("stroke", "#FFD700")
          .attr("stroke-width", 1)
          .attr("rx", 2);
        
        // Only add dimension lines for segments with significant width
        if (width > 5) {
          // Add dimension lines
          const lineY = y + bbox.height / 2 + 3;
          
          // Left line
          indicator.append("line")
            .attr("x1", x)
            .attr("y1", lineY)
            .attr("x2", x)
            .attr("y2", lineY + 5)
            .attr("stroke", "#FFD700")
            .attr("stroke-width", 1);
          
          // Right line
          indicator.append("line")
            .attr("x1", x + width)
            .attr("y1", lineY)
            .attr("x2", x + width)
            .attr("y2", lineY + 5)
            .attr("stroke", "#FFD700")
            .attr("stroke-width", 1);
          
          // Horizontal dimension line
          indicator.append("line")
            .attr("x1", x)
            .attr("y1", lineY + 2.5)
            .attr("x2", x + width)
            .attr("y2", lineY + 2.5)
            .attr("stroke", "#FFD700")
            .attr("stroke-width", 1);
          
          // Arrow heads
          const arrowSize = 2;
          
          // Left arrow
          indicator.append("polygon")
            .attr("points", `${x},${lineY + 2.5} ${x + arrowSize},${lineY + 1} ${x + arrowSize},${lineY + 4}`)
            .attr("fill", "#FFD700");
          
          // Right arrow
          indicator.append("polygon")
            .attr("points", `${x + width},${lineY + 2.5} ${x + width - arrowSize},${lineY + 1} ${x + width - arrowSize},${lineY + 4}`)
            .attr("fill", "#FFD700");
        }
      }
    },
    
    finishDrawingConcrete(coords, svgSelector = "#section-designer-svg") {
      this.isDrawing = false;
      
      // Remove preview and length indicator
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      mainGroup.select(".drawing-preview").remove();
      mainGroup.select(".length-indicator").remove();
      mainGroup.select(".reference-lines").remove();
      
      // Only add if there's significant width
      const width = Math.abs(coords.x - this.drawingStart.x);
      if (width > 2) {
        this.input.id += 1;
        const newSegment = {
          id: this.input.id,
          x1: Math.min(this.drawingStart.x, coords.x),
          x2: Math.max(this.drawingStart.x, coords.x),
          thickness: parseFloat(this.currentThickness),
          area: Math.abs(coords.x - this.drawingStart.x) * parseFloat(this.currentThickness)
        };
        
        this.section.concrete_segments.push(newSegment);
        // The section watcher will handle updating both views
      }
      
      this.drawingStart = null;
    },
    
    showDynamicDimensions(coords, svgSelector = "#section-designer-svg") {
      if (this.designMode === 'pan') return;
      
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      
      // Remove existing dimension lines
      mainGroup.select(".dynamic-dimensions").remove();
      
      // Create dimension group
      const dimGroup = mainGroup.append("g").attr("class", "dynamic-dimensions");
      
      if (this.designMode === 'steel') {
        this.showSteelDimensions(dimGroup, coords);
      } else if (this.designMode === 'concrete') {
        this.showConcreteDimensions(dimGroup, coords);
      }
    },
    
    showSteelDimensions(dimGroup, coords) {
      // Check if position is within concrete segments
      const withinConcrete = this.section.concrete_segments.filter(segment => {
        return coords.x >= Math.min(segment.x1, segment.x2) && 
               coords.x <= Math.max(segment.x1, segment.x2) &&
               Math.abs(coords.y) <= segment.thickness / 2;
      });
      
      // Show coordinate dimensions
      this.drawCoordinateDimensions(dimGroup, coords, withinConcrete.length > 0);
      
      // Show distances to nearest steel areas
      const nearestSteel = this.findNearestSteel(coords.x);
      if (nearestSteel && Math.abs(coords.x - nearestSteel.x) < 50) {
        this.drawDistanceDimension(dimGroup, coords.x, nearestSteel.x, coords.y - 15, 
          `${Math.abs(coords.x - nearestSteel.x).toFixed(1)} cm`, '#2D2D2D');
      }
      
      // Show distances to concrete edges if within concrete
      if (withinConcrete.length > 0) {
        const segment = withinConcrete[0];
        const leftEdge = Math.min(segment.x1, segment.x2);
        const rightEdge = Math.max(segment.x1, segment.x2);
        
        // Distance to left edge
        if (coords.x - leftEdge > 2) {
          this.drawDistanceDimension(dimGroup, leftEdge, coords.x, coords.y + 15,
            `${(coords.x - leftEdge).toFixed(1)} cm`, '#2D2D2D');
        }
        
        // Distance to right edge
        if (rightEdge - coords.x > 2) {
          this.drawDistanceDimension(dimGroup, coords.x, rightEdge, coords.y + 25,
            `${(rightEdge - coords.x).toFixed(1)} cm`, '#2D2D2D');
        }
      }
    },
    
    showConcreteDimensions(dimGroup, coords) {
      // Show coordinate dimensions
      this.drawCoordinateDimensions(dimGroup, coords, true);
      
      // Show distances to existing concrete segments
      const nearestSegment = this.findNearestConcreteEdge(coords.x);
      if (nearestSegment && nearestSegment.distance < 50) {
        const segment = nearestSegment.segment;
        const edgeX = nearestSegment.edge === 'left' ? 
          Math.min(segment.x1, segment.x2) : Math.max(segment.x1, segment.x2);
        
        this.drawDistanceDimension(dimGroup, coords.x, edgeX, coords.y + 15,
          `${nearestSegment.distance.toFixed(1)} cm`, '#2D2D2D');
      }
    },
    
    drawCoordinateDimensions(dimGroup, coords, isValid) {
      const color = isValid ? '#333' : '#2D2D2D';
      const halfWidth = this.canvasWidth / 2;
      
      // Convert internal coordinate to positive user coordinate
      const userX = coords.x + halfWidth; // Add halfWidth to make all coordinates positive
      
      // Only show X coordinate dimension line (horizontal at bottom)
      const xDimY = 45;
      this.drawDimensionLine(dimGroup, -halfWidth, xDimY, coords.x, xDimY, 
        `X: ${userX.toFixed(1)} cm`, color, 'bottom');
      
      // Remove Y coordinate dimension line - no longer showing Y measurements
    },
    
    drawDistanceDimension(dimGroup, x1, x2, y, text, color) {
      if (Math.abs(x2 - x1) < 1) return; // Skip very small distances
      
      this.drawDimensionLine(dimGroup, x1, y, x2, y, text, color, 'top');
    },
    
    drawDimensionLine(dimGroup, x1, y1, x2, y2, text, color = '#333', textPosition = 'top') {
      const isHorizontal = Math.abs(y2 - y1) < 0.1;
      const isVertical = Math.abs(x2 - x1) < 0.1;
      
      // Main dimension line
      dimGroup.append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "2,2");
      
      // Extension lines
      if (isHorizontal) {
        // Vertical extension lines for horizontal dimension
        const extLen = 3;
        dimGroup.append("line")
          .attr("x1", x1).attr("y1", y1 - extLen)
          .attr("x2", x1).attr("y2", y1 + extLen)
          .attr("stroke", color).attr("stroke-width", 1);
        dimGroup.append("line")
          .attr("x1", x2).attr("y1", y2 - extLen)
          .attr("x2", x2).attr("y2", y2 + extLen)
          .attr("stroke", color).attr("stroke-width", 1);
      } else if (isVertical) {
        // Horizontal extension lines for vertical dimension
        const extLen = 3;
        dimGroup.append("line")
          .attr("x1", x1 - extLen).attr("y1", y1)
          .attr("x2", x1 + extLen).attr("y2", y1)
          .attr("stroke", color).attr("stroke-width", 1);
        dimGroup.append("line")
          .attr("x1", x2 - extLen).attr("y1", y2)
          .attr("x2", x2 + extLen).attr("y2", y2)
          .attr("stroke", color).attr("stroke-width", 1);
      }
      
      // Arrow heads
      const arrowSize = 2;
      if (isHorizontal && Math.abs(x2 - x1) > 10) {
        // Left arrow
        dimGroup.append("polygon")
          .attr("points", `${x1},${y1} ${x1 + arrowSize},${y1 - arrowSize/2} ${x1 + arrowSize},${y1 + arrowSize/2}`)
          .attr("fill", color);
        // Right arrow  
        dimGroup.append("polygon")
          .attr("points", `${x2},${y2} ${x2 - arrowSize},${y2 - arrowSize/2} ${x2 - arrowSize},${y2 + arrowSize/2}`)
          .attr("fill", color);
      } else if (isVertical && Math.abs(y2 - y1) > 10) {
        // Top arrow
        dimGroup.append("polygon")
          .attr("points", `${x1},${y1} ${x1 - arrowSize/2},${y1 + arrowSize} ${x1 + arrowSize/2},${y1 + arrowSize}`)
          .attr("fill", color);
        // Bottom arrow
        dimGroup.append("polygon")
          .attr("points", `${x2},${y2} ${x2 - arrowSize/2},${y2 - arrowSize} ${x2 + arrowSize/2},${y2 - arrowSize}`)
          .attr("fill", color);
      }
      
      // Text label
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      
      let textX = centerX;
      let textY = centerY;
      let textAnchor = "middle";
      let dy = "0.35em";
      
      if (textPosition === 'top') {
        textY = centerY - 5;
      } else if (textPosition === 'bottom') {
        textY = centerY + 8;
      } else if (textPosition === 'left') {
        textX = centerX - 8;
        textAnchor = "end";
      } else if (textPosition === 'right') {
        textX = centerX + 8;
        textAnchor = "start";
      }
      
      const textElement = dimGroup.append("text")
        .attr("x", textX)
        .attr("y", textY)
        .attr("text-anchor", textAnchor)
        .attr("dy", dy)
        .attr("font-size", "8")
        .attr("font-weight", "bold")
        .attr("fill", color)
        .text(text);
    },
    
    hideDynamicDimensions(svgSelector = "#section-designer-svg") {
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      mainGroup.select(".dynamic-dimensions").remove();
    },
    
    findNearestSteel(x) {
      if (this.section.steel_areas.length === 0) return null;
      
      let nearest = this.section.steel_areas[0];
      let minDistance = Math.abs(x - nearest.x);
      
      this.section.steel_areas.forEach(steel => {
        const distance = Math.abs(x - steel.x);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = steel;
        }
      });
      
      return nearest;
    },
    
    findNearestConcreteEdge(x) {
      if (this.section.concrete_segments.length === 0) return null;
      
      let nearestDistance = Infinity;
      let nearestInfo = null;
      
      this.section.concrete_segments.forEach(segment => {
        const leftEdge = Math.min(segment.x1, segment.x2);
        const rightEdge = Math.max(segment.x1, segment.x2);
        
        const distToLeft = Math.abs(x - leftEdge);
        const distToRight = Math.abs(x - rightEdge);
        
        if (distToLeft < nearestDistance) {
          nearestDistance = distToLeft;
          nearestInfo = { distance: distToLeft, edge: 'left', segment };
        }
        
        if (distToRight < nearestDistance) {
          nearestDistance = distToRight;
          nearestInfo = { distance: distToRight, edge: 'right', segment };
        }
      });
      
      return nearestInfo;
    },
    
    showReferenceLines(coords, svgSelector = "#section-designer-svg") {
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      const refGroup = mainGroup.append("g").attr("class", "reference-lines");
      
      // Show vertical reference lines at existing concrete edges and steel positions
      const referenceX = new Set();
      
      // Add concrete segment edges
      this.section.concrete_segments.forEach(segment => {
        referenceX.add(segment.x1);
        referenceX.add(segment.x2);
      });
      
      // Add steel positions
      this.section.steel_areas.forEach(steel => {
        referenceX.add(steel.x);
      });
      
      // Draw reference lines within reasonable distance
      const halfWidth = this.canvasWidth / 2;
      referenceX.forEach(x => {
        if (Math.abs(x - coords.x) < 50) { // Only show nearby references
          refGroup.append("line")
            .attr("x1", x)
            .attr("y1", -50)
            .attr("x2", x)
            .attr("y2", 50)
            .attr("stroke", "#FFA500")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3")
            .attr("opacity", 0.7);
        }
      });
    },
    
    updateReferenceLines(coords, svgSelector = "#section-designer-svg") {
      // Remove and recreate reference lines for current position
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      mainGroup.select(".reference-lines").remove();
      this.showReferenceLines(coords, svgSelector);
    },
    
    showPlacementConfirmation(coords, svgSelector = "#section-designer-svg") {
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      
      // Show temporary success indicator
      const confirmation = mainGroup.append("g").attr("class", "placement-feedback");
      
      // Green circle
      confirmation.append("circle")
        .attr("cx", coords.x)
        .attr("cy", coords.y)
        .attr("r", 8)
        .attr("fill", "none")
        .attr("stroke", "#28a745")
        .attr("stroke-width", 3)
        .attr("opacity", 1)
        .transition()
        .duration(1000)
        .attr("r", 15)
        .attr("opacity", 0)
        .remove();
      
      // Check mark
      confirmation.append("text")
        .attr("x", coords.x)
        .attr("y", coords.y + 3)
        .attr("text-anchor", "middle")
        .attr("font-size", "10")
        .attr("fill", "#28a745")
        .attr("font-weight", "bold")
        .text("✓")
        .transition()
        .duration(1000)
        .attr("opacity", 0)
        .remove();
    },
    
    showPlacementError(coords, svgSelector = "#section-designer-svg") {
      const mainGroup = d3.select(`${svgSelector} .main-group`);
      
      // Show temporary error indicator
      const error = mainGroup.append("g").attr("class", "placement-feedback");
      
      // Red circle
      error.append("circle")
        .attr("cx", coords.x)
        .attr("cy", coords.y)
        .attr("r", 8)
        .attr("fill", "none")
        .attr("stroke", "#dc3545")
        .attr("stroke-width", 3)
        .attr("opacity", 1)
        .transition()
        .duration(1000)
        .attr("r", 15)
        .attr("opacity", 0)
        .remove();
      
      // X mark
      error.append("text")
        .attr("x", coords.x)
        .attr("y", coords.y + 3)
        .attr("text-anchor", "middle")
        .attr("font-size", "10")
        .attr("fill", "#dc3545")
        .attr("font-weight", "bold")
        .text("✗")
        .transition()
        .duration(1000)
        .attr("opacity", 0)
        .remove();
    },
    
    addSteelAtPosition(coords, svgSelector = "#section-designer-svg") {
      // Check if position is within any concrete segment
      const isWithinConcrete = this.section.concrete_segments.some(segment => {
        return coords.x >= Math.min(segment.x1, segment.x2) && 
               coords.x <= Math.max(segment.x1, segment.x2) &&
               Math.abs(coords.y) <= segment.thickness / 2;
      });
      
      if (isWithinConcrete) {
        this.input.id += 1;
        const newSteel = {
          id: this.input.id,
          x: coords.x,
          area: parseFloat(this.currentSteelArea)
        };
        
        this.section.steel_areas.push(newSteel);
        // The section watcher will handle updating both views
        
        // Show temporary placement confirmation
        this.showPlacementConfirmation(coords, svgSelector);
      } else {
        // Show error feedback
        this.showPlacementError(coords, svgSelector);
      }
    },
    
    selectElement(elementId, isSteel) {
      if (isSteel) {
        if (confirm("¿Eliminar área de acero?")) {
          this.delete_steel(elementId);
        }
      } else {
        if (confirm("¿Eliminar segmento de hormigón?")) {
          this.delete_concrete(elementId);
        }
      }
    },
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
        .attr("stroke", "#FFD700")
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
        .style("font-size", "10px") // Change font-size here
        .text("ε (m/m)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
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
        .attr("stroke", "#FFD700")
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
        .style("font-size", "10px") // Change font-size here
        .text("ε (m/m)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("fs (MPa)");
    },
    add_steel() {
      this.input.id += 1
      this.section.steel_areas.push({
        'id': this.input.id,
        'x': parseFloat(this.input.x),
        'area': parseFloat(this.input.area),
      })
      this.plot_section_designer(); // Update the designer view
    },
    add_concrete() {
      this.input.id += 1;
      this.section.concrete_segments.push({
        'id': this.input.id,
        'x1': parseFloat(this.input.x1),
        'x2': parseFloat(this.input.x2),
        'thickness': parseFloat(this.input.thickness),
        'area': Math.abs(parseFloat(this.input.x2) - parseFloat(this.input.x1)) * parseFloat(this.input.thickness),
      });
      this.plot_section_designer(); // Update the designer view
    },
    add_interaction_point() {
      this.input.id += 1;
      this.interaction_points.push({
        'id': this.input.id,
        'x': this.input.Pu,
        'y': this.input.Mu,
      });
    },
    delete_interaction_point(id) {
      this.interaction_points = this.interaction_points.filter(item => item.id !== id)
    },
    delete_steel(id) {
      this.section.steel_areas = this.section.steel_areas.filter(item => item.id !== id)
      this.plot_section_designer(); // Update the designer view
    },
    delete_concrete(id) {
      this.section.concrete_segments = this.section.concrete_segments.filter(item => item.id !== id)
      this.plot_section_designer(); // Update the designer view
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
      this.xg = 0;
      var total_concrete_area = 0;
      this.section.concrete_segments.forEach(element => {
        total_concrete_area += element.area;
      });
      this.section.concrete_segments.forEach(element => {
        this.xg += ((element.x2 + element.x1) / 2) * element.area / total_concrete_area;
      });
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
        var P = (P == 0 ? -0.1 : this.axial_load);
        var Mn = Math.abs(Mn_concrete + Mn_steel - P * this.xg);
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
      if (iterator >= 1000) {
        console.log("no converge", P)
      }
      var result = {
        'iterator': iterator,
        'curvature': curvature,
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
      var concrete_fibers = this.get_concrete_fibers();
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
        var P = (P == 0 ? -0.1 : P);
        var Mn = Math.abs(Mn_concrete + Mn_steel - P * this.xg) / 100;
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
        if (error < 1.01 && error > 0.99) {
          break;
          
        }
      }
      if (iterator >= 1000) {
        console.log("no converge", P)
      }
      var result = {
        'iterator': iterator,
        'curvature': -ec / c,
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
        let curvature = (i + 1) / 100000;
        let result = this.calculate_moment_curvature(curvature);
        this.analysis.data.push({ 'x': curvature, 'y': result.Mn / 100 })
      }
    },
    update_interaction_data() {
      this.interaction = [];
      var MaxCompresion = 0;
      var MaxTension = 0;
      this.section.concrete_segments.forEach(element => {
        MaxCompresion += 0.8*element.area / 10000 * 100 * 0.85 * this.concrete.inputs.fc.value;
      });
      this.section.steel_areas.forEach(element => {
        MaxCompresion += 0.8*element.area / 10000 * 100 * (this.steel.inputs.Fy.value - this.concrete.inputs.fc.value);
        MaxTension += element.area / 10000 * 100 * this.steel.inputs.Fy.value ;
      });
      
      if (this.switchState) {
        this.interaction.push({ 'x': 0, 'y': -MaxTension });
      } else {
        this.interaction.push({ 'x': 0, 'y': -MaxTension * 0.9 });
      }
      var axialLoads = [-1];
      var numberOfPoints = 5;
      for (let i = 0; i < numberOfPoints; i++) {
        if (this.switchState) {
          axialLoads.push(-MaxCompresion / numberOfPoints * (i + 1))
        } else {
          axialLoads.push(-MaxCompresion / numberOfPoints * (i + 1))
        }
      };
      for (let i = 0; i < axialLoads.length; i++) {
        let P = axialLoads[i];
        let results = this.calcualte_interaction(P);
        if (this.switchState) {
          var phi = 1;
        } else {
          var phi = Math.min(Math.max(0.65, 0.65 + (results.et - 0.0021) / (0.005 - 0.0021) * (0.90 - 0.65)), 0.9);
        }
        this.interaction.push(
          {
            'x': results.Mn * phi,
            'y': -results.Pn * phi,
            'max_x': results.max_x,
            'c': results.c,
            'ec': results.ec,
          });
      }
      if (this.switchState) {
        this.interaction.push({ 'x': 0, 'y': MaxCompresion });
      } else {
        this.interaction.push({ 'x': 0, 'y': MaxCompresion * 0.65 });
      }
    },
    plot_section() {
      d3.select("#section-svg").remove()
      
      // Calculate bounds for centering
      const allX = [
        ...this.section.concrete_segments.map(obj => obj.x1),
        ...this.section.concrete_segments.map(obj => obj.x2),
        ...this.section.steel_areas.map(obj => obj.x)
      ];
      const allY = [
        ...this.section.concrete_segments.map(obj => obj.thickness / 2),
        ...this.section.concrete_segments.map(obj => -obj.thickness / 2)
      ];
      
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);
      
      const width = maxX - minX;
      const height = maxY - minY;
      const padding = Math.max(width, height) * 0.1; // 10% padding
      
      const viewBoxWidth = width + 2 * padding;
      const viewBoxHeight = height + 2 * padding;
      const viewBoxX = minX - padding;
      const viewBoxY = minY - padding;
      
      // Define the zoom behavior
      function handleZoom(e) {
        d3.select("#section-svg g").attr('transform', e.transform);
      }
      var zoom = d3.zoom().on('zoom', handleZoom);
      const svg = d3.select("#section-container")
        .append("svg")
        .attr("id", "section-svg")
        .attr("width", '100%')
        .attr("height", '100%')
        .attr("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("preserveAspectRatio", "xMidYMid meet")
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
        .attr("stroke", "#FFD700")
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
        .style("font-size", "10px") // Change font-size here
        .text("Φ (m/m)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
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
        .attr('y1', 1)
        .attr('y2', height)
        .attr('stroke', 'tomato')
        .attr('stroke-width', 1)
      // Values of Mn and Φ
      var Mn = this.results.Mn / 100
      var Cur = this.curvature / 100000
      g.append("text")
        .attr('id', 'vertical-line-text')
        .attr("text-anchor", "end")
        .attr("x", xScale(this.curvature / 100000) + 40)
        .attr("y", margin.top - 30)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text('(' + Cur.toFixed(6) + ', ' + Mn.toFixed(2) + ')');
    },
    plot_deformation_profile() {
      d3.select("#def-profile-svg").html('')
      const svg = d3.select("#def-profile-svg");
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };
      const width = +svg.attr("width") - margin.left - margin.right;
      const height = +svg.attr("height") - margin.top - margin.bottom;
      const g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      
      // Convert coordinates to positive display coordinates
      const halfWidth = this.canvasWidth / 2;
      const min_x_display = this.results.min_x + halfWidth;
      const max_x_display = this.results.max_x + halfWidth;
      
      const data = [
        { 'x': min_x_display, 'y': 0 },
        { 'x': min_x_display, 'y': this.results.et },
        { 'x': max_x_display, 'y': this.results.ec },
        { 'x': max_x_display, 'y': 0 },
        { 'x': min_x_display, 'y': 0 },
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
        .attr("stroke", "#FFD700")
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
        .style("font-size", "10px") // Change font-size here
        .text('εc = ' + this.results.ec.toFixed(5));
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", margin.top - 10)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text('c = ' + this.results.c.toFixed(2) + ' cm');
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", margin.top - 20)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text('εt = ' + this.results.et.toFixed(5));
      // X Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("ε (m/m)");
    },
    plot_concrete_profile() {
      d3.select("#concrete-profile-svg").html('')
      const svg = d3.select("#concrete-profile-svg");
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };
      const width = +svg.attr("width") - margin.left - margin.right;
      const height = +svg.attr("height") - margin.top - margin.bottom;
      const g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      
      // Convert coordinates to positive display coordinates
      const halfWidth = this.canvasWidth / 2;
      
      var data = [];
      this.results.concrete_results.forEach(element => {
        data.push({
          'x': element.position + halfWidth, // Convert to display coordinates
          'y': element.tension,
        })
      });
      // Scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x)) // Use actual data extent
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
        .attr("stroke", "#FFD700")
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
        .style("font-size", "10px") // Change font-size here
        .text('Max fc = ' + max_fc.toFixed(1) + ' MPa');
      // Add the X Axis
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(3));
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("fc (MPa)");
    },
    plot_steel_profile() {
      d3.select("#steel-profile-svg").html('')
      const svg = d3.select("#steel-profile-svg");
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };
      const width = +svg.attr("width") - margin.left - margin.right;
      const height = +svg.attr("height") - margin.top - margin.bottom;
      const g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      
      // Convert coordinates to positive display coordinates
      const halfWidth = this.canvasWidth / 2;
      
      var data = [{ 'x': 0, 'y': 0 }];
      this.results.steel_results.forEach(element => {
        data.push({
          'x': element.position + halfWidth, // Convert to display coordinates
          'y': element.tension,
        })
      });
      
      // Convert min/max coordinates to display coordinates
      const min_x_display = this.results.min_x + halfWidth;
      const max_x_display = this.results.max_x + halfWidth;
      
      // Scales
      const xScale = d3.scaleLinear()
        .domain([min_x_display, max_x_display])
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
          .attr('stroke', "#FFD700")
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
        .style("font-size", "10px") // Change font-size here
        .text('Max fs = ' + max_fs.toFixed(1) + ' MPa');
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", 10)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text('Min fs = ' + min_fs.toFixed(1) + ' MPa');
      // Add the X Axis
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(3));
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("x (cm)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("fs (MPa)");
    },
    plot_interaction() {
      const data = this.interaction;
      d3.select("#interaction-diagram-svg").html('')
      const svg = d3.select("#interaction-diagram-svg"),
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
        .domain(d3.extent(data, d => d.y))
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
        .attr("stroke", "#FFD700")
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
        .call(d3.axisLeft(yScale).ticks(5));
      // X Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.bottom)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("M (tonf-m)");
      // Y Axis Title
      g.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -margin.top)
        .style("font-family", "Arial") // Change font-family here
        .style("font-size", "10px") // Change font-size here
        .text("P (tonf)");
      this.interaction_points.forEach(element => {
        g.append('circle')
          .attr('cx', xScale(element.y)) // Set circle's x-coordinate
          .attr('cy', yScale(element.x)) // Set circle's y-coordinate
          .attr('r', 3) // Radius of the circle
          .attr('fill', '#FFDC01') // Color of the circle
          .attr('stroke', 'black'); // Color of the circle
      });
    }
  },
  mounted() {
    // Load saved section data first
    this.loadSection();
    
    this.calculate_xg();
    this.plotSteel();
    this.plotConcrete();
    this.plot_section();
    this.plot_section_designer(); // Initialize the interactive designer
    this.update_moment_curvature_data();
    this.update_interaction_data();
    this.plot_moment_curvature();
    this.plot_interaction();
  },
  watch: {
    steel: {
      handler() {
        this.plotSteel();
        this.update_moment_curvature_data();
        this.update_interaction_data();
        this.plot_moment_curvature();
        this.plot_interaction();
      },
      deep: true
    },
    concrete: {
      handler() {
        this.plotConcrete();
        this.update_moment_curvature_data();
        this.update_interaction_data();
        this.plot_moment_curvature();
        this.plot_interaction();
      },
      deep: true
    },
    section: {
      handler() {
        this.calculate_xg();
        this.plot_section();
        this.plot_section_designer(); // Update the interactive designer
        if (this.showDesignerModal) {
          this.plot_section_designer('#section-designer-modal-container', '#section-designer-modal-svg');
        }
        this.update_moment_curvature_data();
        this.update_interaction_data();
        this.plot_moment_curvature();
        this.plot_interaction();
        
        // Auto-save section data
        this.saveSection();
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
    },
    // Watch for changes in steel areas to control axial load
    'section.steel_areas': {
      handler() {
        // If no steel areas, set axial load to -0.1
        if (!this.section.steel_areas || this.section.steel_areas.length === 0) {
          this.axial_load = -0.1;
        }
      },
      deep: true
    },
    interaction_points: {
      handler() {
        this.plot_interaction();
      }
    },
    switchState: {
      handler() {
        this.update_interaction_data();
        this.plot_interaction();
      }
    },
    showGrid: {
      handler() {
        this.plot_section_designer();
        if (this.showDesignerModal) {
          this.plot_section_designer('#section-designer-modal-container', '#section-designer-modal-svg');
        }
        // Auto-save UI settings
        this.saveSection();
      }
    },
    gridSize: {
      handler(newVal, oldVal) {
        // Validate gridSize before updating
        if (newVal && newVal > 0 && newVal <= 100) {
          console.log(`Grid size changed from ${oldVal} to ${newVal}`);
          this.plot_section_designer();
          if (this.showDesignerModal) {
            this.plot_section_designer('#section-designer-modal-container', '#section-designer-modal-svg');
          }
          // Auto-save UI settings
          this.saveSection();
        } else {
          console.warn(`Invalid grid size: ${newVal}. Must be between 0.5 and 100.`);
          // Revert to previous value if invalid
          this.$nextTick(() => {
            this.gridSize = oldVal || 5;
          });
        }
      }
    },
    canvasWidth: {
      handler(newVal, oldVal) {
        // Validate canvasWidth before updating
        if (newVal && newVal >= 50 && newVal <= 2000) {
          console.log(`Canvas width changed from ${oldVal} to ${newVal}`);
          this.plot_section_designer();
          if (this.showDesignerModal) {
            this.plot_section_designer('#section-designer-modal-container', '#section-designer-modal-svg');
          }
          // Auto-save UI settings
          this.saveSection();
        } else {
          console.warn(`Invalid canvas width: ${newVal}. Reverting to previous value.`);
          // Revert to previous value if invalid
          this.$nextTick(() => {
            this.canvasWidth = oldVal || 200;
          });
        }
      }
    },
    currentThickness: {
      handler() {
        // Update preview if drawing - for both compact and modal
        if (this.isDrawing) {
          d3.select("#section-designer-svg").select(".drawing-preview")
            .attr("y", -this.currentThickness / 2)
            .attr("height", this.currentThickness);
          
          // Also update modal preview if modal is open
          if (this.showDesignerModal) {
            d3.select("#section-designer-modal-svg").select(".drawing-preview")
              .attr("y", -this.currentThickness / 2)
              .attr("height", this.currentThickness);
          }
        }
        // Auto-save UI settings
        this.saveSection();
      }
    },
    snapToGrid: {
      handler() {
        // Auto-save UI settings
        this.saveSection();
      }
    },
    currentSteelArea: {
      handler() {
        // Auto-save UI settings
        this.saveSection();
      }
    },
    designMode: {
      handler() {
        // Auto-save UI settings
        this.saveSection();
      }
    }
  }
});


