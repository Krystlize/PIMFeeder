import axios from 'axios';
import { ProcessingResult, ProcessedAttribute, AttributeGroup } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
const HUGGING_FACE_TOKEN = process.env.REACT_APP_HUGGING_FACE_TOKEN;

// Create an axios instance with default headers
const api = axios.create({
  headers: {
    'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

export const processPDFWithAI = async (
  file: File,
  division: string,
  category: string
): Promise<ProcessingResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('division', division);
  formData.append('category', category);

  console.log('====== SENDING PDF TO BACKEND ======');
  console.log('Division:', division);
  console.log('Category:', category); 
  console.log('File name:', file.name);
  console.log('File size:', Math.round(file.size / 1024), 'KB');

  try {
    // Add a timeout to the request to allow for debugging
    const response = await api.post(`${API_BASE_URL}/process-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000, // 30 second timeout to allow for debugging
    });
    
    console.log('====== RECEIVED RESPONSE ======');
    console.log('Response status:', response.status);
    console.log('Number of attributes:', response.data.attributes?.length || 0);
    console.log('First attribute:', response.data.attributes?.[0]);
    console.log('Template groups:', response.data.template?.length || 0);
    
    // Check for the mockTemplate fallback
    if (!response.data.template) {
      console.log('No template in response, using mock template');
    }
    
    return {
      attributes: response.data.attributes,
      rawText: response.data.rawText,
      template: response.data.template || getMockTemplateForCategory(division, category)
    };
  } catch (error) {
    console.error('====== ERROR PROCESSING PDF ======');
    console.error('Error:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('Axios error status:', error.response?.status);
      console.error('Axios error data:', error.response?.data);
    }
    
    // Provide default attributes and a template even in error cases
    // This allows the application to function even when the backend is unavailable
    console.log('Falling back to mock data for PDF processing');
    
    // Special check for different fixture types
    const categoryLower = category.toLowerCase();
    let fixtureType = 'unknown';
    
    // Determine fixture type for fallback data
    if (categoryLower.includes('toilet') || categoryLower.includes('urinal') || categoryLower.includes('water closet')) {
      fixtureType = 'toilet';
    } else if (categoryLower.includes('sink') || categoryLower.includes('lavatory') || categoryLower.includes('basin')) {
      fixtureType = 'sink';
    } else if (categoryLower.includes('shower') || categoryLower.includes('bath')) {
      fixtureType = 'shower';
    } else if (categoryLower.includes('faucet') || categoryLower.includes('tap') || 
              (categoryLower.includes('fixture') && !categoryLower.includes('drain')) || 
              category === 'Commercial Fixtures') {
      fixtureType = 'faucet';
    } else if (categoryLower.includes('drain')) {
      fixtureType = 'drain';
    }
    
    console.log(`Detected fixture type for fallback: ${fixtureType}`);
    
    // FAUCET fallback data
    if (fixtureType === 'faucet') {
      console.log('Providing FAUCET mock data for Commercial Fixtures');
      
      return {
        attributes: [
          { name: "Product Number", value: "7385.004" },
          { name: "Product Name", value: "Colony PRO Single-Handle Kitchen Faucet" },
          { name: "Product Description", value: "Single-handle pull-down kitchen faucet with ceramic disc valve and metal lever handle" },
          { name: "Manufacturer", value: "American Standard" },
          { name: "Flow Rate", value: "1.5 GPM" },
          { name: "Material", value: "Brass" },
          { name: "Finish", value: "Polished Chrome" },
          { name: "Division", value: division },
          { name: "Category", value: category }
        ],
        rawText: "Sample text content from PDF. Using Commercial Fixtures mock data.",
        template: getMockTemplateForCategory(division, category)
      };
    }
    // TOILET fallback data
    else if (fixtureType === 'toilet') {
      return {
        attributes: [
          { name: "Product Number", value: "2257.101" },
          { name: "Product Name", value: "Madera FloWise Commercial Toilet" },
          { name: "Product Description", value: "Commercial 1.6 GPF toilet with EverClean surface and PowerWash rim" },
          { name: "Manufacturer", value: "American Standard" },
          { name: "Flush Rate", value: "1.6 GPF" },
          { name: "Bowl Type", value: "Elongated" },
          { name: "Configuration", value: "Floor Mount" },
          { name: "Division", value: division },
          { name: "Category", value: category }
        ],
        rawText: "Sample text content from PDF. Using Commercial Toilet mock data.",
        template: getMockTemplateForCategory(division, category)
      };
    }
    // SINK fallback data
    else if (fixtureType === 'sink') {
      return {
        attributes: [
          { name: "Product Number", value: "0355.012" },
          { name: "Product Name", value: "Lucerne Wall-Mount Lavatory Sink" },
          { name: "Product Description", value: "Wall-mounted commercial sink with integral backsplash and soap depression" },
          { name: "Manufacturer", value: "American Standard" },
          { name: "Material", value: "Vitreous china" },
          { name: "Mounting Type", value: "Wall mount" },
          { name: "Dimensions", value: "20.5\" W x 18.25\" D" },
          { name: "Division", value: division },
          { name: "Category", value: category }
        ],
        rawText: "Sample text content from PDF. Using Commercial Sink mock data.",
        template: getMockTemplateForCategory(division, category)
      };
    }
    // DRAIN fallback data (default)
    else {
      return {
        attributes: [
          { name: "Product Number", value: "FD-100-A" },
          { name: "Product Name", value: "Floor Drain with Round Strainer" },
          { name: "Product Description", value: "Epoxy coated cast iron floor drain with anchor flange, reversible clamping collar with primary and secondary weepholes, adjustable round heel proof nickel bronze strainer, and no hub (standard) outlet" },
          { name: "Specification Number", value: "ES-WD-FD-100-A" },
          { name: "Manufacturer", value: "Wade Drains" },
          { name: "Division", value: division },
          { name: "Category", value: category }
        ],
        rawText: "Sample text content from PDF. Backend connection failed - using mock data.",
        template: getMockTemplateForCategory(division, category)
      };
    }
  }
};

export const chatWithLLM = async (
  message: string,
  attributes: ProcessedAttribute[],
  context: string
): Promise<string> => {
  try {
    const response = await api.post(`${API_BASE_URL}/chat`, {
      message,
      attributes,
      context
    });
    return response.data.response;
  } catch (error) {
    console.error('Error communicating with LLM:', error);
    throw new Error('Failed to get response from AI. Please try again.');
  }
};

export const updateAttributesWithLLM = async (
  message: string,
  currentAttributes: ProcessedAttribute[],
  context: string
): Promise<ProcessedAttribute[]> => {
  try {
    const response = await api.post(`${API_BASE_URL}/update-attributes`, {
      message,
      attributes: currentAttributes,
      context,
      instructions: `
        When extracting or updating attributes, pay special attention to:
        1. Pipe size attributes - create separate attributes for nominal size, actual size, etc.
        2. Properly format dimensions with correct units
        3. Group similar attributes together for easier PIM synchronization
        4. Maintain all original attributes unless explicitly asked to modify them
      `
    });
    return response.data.updatedAttributes;
  } catch (error) {
    console.error('Error updating attributes:', error);
    throw new Error('Failed to update attributes. Please try again.');
  }
};

export const getAttributeTemplateFromAI = async (
  prompt: string,
  division: string,
  category: string,
  productDescription: string
): Promise<AttributeGroup[]> => {
  try {
    // Add a timeout to the request to prevent long hanging in case of CORS issues
    const response = await api.post(`${API_BASE_URL}/generate-template`, {
      prompt,
      division,
      category,
      productDescription
    }, {
      timeout: 5000,  // 5 second timeout
    });
    
    return response.data.template;
  } catch (error) {
    console.error('Error generating attribute template:', error);
    
    // Return mock data for development or in case of errors
    console.log('Falling back to mock template data');
    
    // Determine the appropriate mock template based on division and category
    return getMockTemplateForCategory(division, category);
  }
};

function getMockTemplateForCategory(division: string, category: string): AttributeGroup[] {
  const divisionLower = division.toLowerCase();
  const categoryLower = category.toLowerCase();
  
  // Determine specific fixture type
  let fixtureType = 'unknown';
  
  // Determine fixture type based on category
  if (categoryLower.includes('toilet') || categoryLower.includes('urinal') || categoryLower.includes('water closet')) {
    fixtureType = 'toilet';
  } else if (categoryLower.includes('sink') || categoryLower.includes('lavatory') || categoryLower.includes('basin')) {
    fixtureType = 'sink';
  } else if (categoryLower.includes('shower') || categoryLower.includes('bath')) {
    fixtureType = 'shower';
  } else if (categoryLower.includes('faucet') || categoryLower.includes('tap') || 
            (categoryLower.includes('fixture') && !categoryLower.includes('drain')) || 
            category === 'Commercial Fixtures') {
    fixtureType = 'faucet';
  } else if (categoryLower.includes('drain')) {
    fixtureType = 'drain';
  }
  
  console.log(`Template selection based on fixture type: ${fixtureType}`);
  
  // Mock template for plumbing/drainage
  if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
      (fixtureType === 'drain')) {
    
    return [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Specification Number',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Load Rating',
          'Load Rating Classification',
          'Pipe Size',
          'Outlet Type',
          'Strainer Size', 
          'Strainer Material',
          'Optional Body Material',
          'Top/grate material',
          'Body material',
          'Outlet connection type',
          'Trap configuration'
        ],
        isEssential: true
      },
      {
        groupName: 'Pipe Sizing Options',
        attributes: [
          'Pipe Size Suffix: 2 (2" Pipe Size)',
          'Pipe Size Suffix: 3 (3" Pipe Size)',
          'Pipe Size Suffix: 4 (4" Pipe Size)',
          'Pipe Size Suffix: 6 (6" Pipe Size)'
        ],
        isEssential: true
      },
      {
        groupName: 'Outlet Types',
        attributes: [
          'Outlet Type Suffix: MH (No Hub)',
          'Outlet Type Suffix: P (Push On)',
          'Outlet Type Suffix: T (Threaded Outlet)',
          'Outlet Type Suffix: X (Inside Caulk)'
        ],
        isEssential: true
      },
      {
        groupName: 'Strainer Options',
        attributes: [
          'Strainer Suffix: A5 (5" Dia. Nickel Bronze)',
          'Strainer Suffix: A6 (6" Dia. Nickel Bronze)',
          'Strainer Suffix: A7 (7" Dia. Nickel Bronze)',
          'Strainer Suffix: A8 (8" Dia. Nickel Bronze)',
          'Strainer Suffix: A10 (10" Dia. Nickel Bronze)'
        ],
        isEssential: true
      },
      {
        groupName: 'Options',
        attributes: [
          'Options Suffix: -5 (Sediment Bucket)',
          'Options Suffix: -6 (Vandal Proof)',
          'Options Suffix: -7 (Trap Primer Tapping)',
          'Options Suffix: -8 (Backwater Valve)',
          'Options Suffix: -13 (Galvanized Coating)',
          'Options Suffix: -15 (Strainer Extension)',
          'Options Suffix: -H4-50 (4" Round Cast Iron Funnel)',
          'Options Suffix: -H4-1 (4" Round Nickel Bronze Funnel)',
          'Options Suffix: -F6-1 (6" Round Nickel Bronze Funnel)',
          'Options Suffix: -6-50 (4" x 9" Oval Nickel Bronze Funnel)'
        ],
        isEssential: true
      },
      {
        groupName: 'Body Material Options',
        attributes: [
          'Optional Body Material Suffix: -60 (PVC Body w/Socket Outlet)',
          'Optional Body Material Suffix: -61 (ABS Body w/Socket Outlet)'
        ],
        isEssential: true
      },
      {
        groupName: 'Strainer Size Specifications',
        attributes: [
          'Strainer Size: 5"(127)',
          'Strainer Size: 6"(152)',
          'Strainer Size: 7"(178)',
          'Strainer Size: 8"(203)',
          'Strainer Size: 10"(254)'
        ],
        isEssential: true
      },
      {
        groupName: 'Dimensional Data',
        attributes: [
          'Pipe Size: 2"(51)',
          'Pipe Size: 3"(76)',
          'Pipe Size: 4"(102)',
          'Pipe Size: 6"(152)'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Attributes',
        attributes: [
          'Flow rate capacity (GPM)',
          'Anti-ponding design (slope to drain)',
          'Membrane clamp/flashing collar (for waterproofing areas)',
          'Height adjustability (fixed or adjustable)',
          'ADA compliance (where applicable)',
          'Heel-proof requirements (if in pedestrian areas)',
          'Anti-bacterial coating (for healthcare facilities)',
          'Chemical resistance (for industrial applications)',
          'Fire rating (if penetrating fire-rated floors)'
        ],
        isEssential: false
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'Standards Compliance',
          'ASME A112.6.3 (Floor and Trench Drains)',
          'ASME A112.21.2M (Roof Drains)',
          'CSA B79 (Commercial and Residential Drains in Canada)',
          'NSF/ANSI 14 (Plastic Components and Materials)',
          'Local plumbing codes (requirements vary by jurisdiction)',
          'Buy American Act compliance (for government projects)'
        ],
        isEssential: true
      }
    ];
  }
  // Mock template for commercial faucets
  else if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
          (fixtureType === 'faucet')) {
    
    console.log("Selected commercial faucet template for category:", category);
    
    return [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Model Series',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Flow Rate (GPM/LPM)',
          'Maximum Flow Rate at 60 PSI',
          'Spout Reach (inches/mm)',
          'Spout Height (inches/mm)',
          'Center-to-Center Dimensions',
          'Mounting Type (deck-mount, wall-mount, etc.)',
          'Handle Type (single, double, cross, lever, etc.)',
          'Connection Type (compression, threaded, etc.)',
          'Inlet Size',
          'Material (brass, stainless steel, etc.)',
          'Finish (chrome, brushed nickel, etc.)',
          'LEAD FREE Certification'
        ],
        isEssential: true
      },
      {
        groupName: 'Operation and Controls',
        attributes: [
          'Operation Type (manual, electronic, touchless)',
          'Sensor Type (infrared, capacitive)',
          'Power Source (battery, AC, hardwired)',
          'Battery Type and Life',
          'Auto Shut-off Timer',
          'Temperature Control (mixing valve, thermostatic)',
          'Temperature Range',
          'Pre-set Temperature Option',
          'Temperature Limit Stop'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Features',
        attributes: [
          'Aerator Type',
          'Drain Assembly Included',
          'ADA Compliant',
          'Water-Saving Features',
          'Vandal Resistant Features',
          'Laminar Flow Option',
          'Self-Closing Mechanism',
          'Temperature Indicator',
          'Integral Check Valves',
          'Integral Strainers'
        ],
        isEssential: false
      },
      {
        groupName: 'Installation Requirements',
        attributes: [
          'Hole Size Requirements',
          'Deck Thickness Range',
          'Supply Line Requirements',
          'Installation Type (single hole, widespread, centerset)',
          'Number of Mounting Holes',
          'Distance Between Faucet Centers'
        ],
        isEssential: true
      },
      {
        groupName: 'Finishes and Options',
        attributes: [
          'Available Finishes',
          'Special Coatings',
          'Antimicrobial Surface Treatment',
          'Optional Accessories',
          'Replacement Parts Availability'
        ],
        isEssential: false
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'NSF/ANSI 61 Certification',
          'NSF/ANSI 372 (Lead Content)',
          'ASME A112.18.1/CSA B125.1',
          'ASSE 1070 Compliance (if temperature regulation)',
          'UPC/IPC Compliance',
          'CALGreen Compliant',
          'WaterSense Labeled',
          'ADA Compliance',
          'California AB 1953 Lead-Free Compliance'
        ],
        isEssential: true
      },
      {
        groupName: 'Warranty and Service',
        attributes: [
          'Warranty Period (years)',
          'Commercial Warranty Details',
          'Parts Warranty',
          'Finish Warranty',
          'Maintenance Requirements'
        ],
        isEssential: true
      }
    ];
  }
  // Mock template for commercial toilets
  else if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
          (fixtureType === 'toilet')) {
    
    console.log("Selected commercial toilet template for category:", category);
    
    return [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Model Series',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Fixture Type (toilet, urinal, bidet)',
          'Bowl Type (elongated, round front)',
          'Configuration (floor mount, wall mount)',
          'Rough-In Dimension',
          'Flush Type (flushometer, tank)',
          'Flush Rate (GPF)',
          'Water Conservation Rating',
          'Trapway Size',
          'Flush Valve Size/Type',
          'Water Surface Area',
          'Material (vitreous china, stainless steel)',
          'Color/Finish',
          'Rim Shape/Configuration',
          'Mounting Hardware',
          'LEAD FREE Certification'
        ],
        isEssential: true
      },
      {
        groupName: 'Operation and Technical Specifications',
        attributes: [
          'Flush Mechanism Type (manual, automatic)',
          'Sensor Type (if electronic)',
          'Power Source (if electronic)',
          'Battery Type and Life (if applicable)',
          'Minimum Operating Pressure',
          'Maximum Performance (MaP) Score',
          'Flush Volume Options',
          'Water Spot Size',
          'Trap Seal Depth'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Features',
        attributes: [
          'Seat Included',
          'Seat Compatibility',
          'Seat Type (open front, closed front)',
          'QuickConnect/EasyInstall Features',
          'Concealed Trapway',
          'Flushing Technology Name',
          'Antimicrobial Surface Treatment',
          'Rim Jets/Wash Features',
          'Noise Reduction Features',
          'Bedpan Cleaner Compatible'
        ],
        isEssential: false
      },
      {
        groupName: 'Installation and Accessibility',
        attributes: [
          'ADA Compliant',
          'Meets Texas Accessibility Standards',
          'Senior Height/Comfort Height',
          'Installation Type',
          'Rough-in Range',
          'Supply Line Requirements',
          'Offset Requirements',
          'Flange Type/Requirements',
          'Wall Carrier Required/Compatible'
        ],
        isEssential: true
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASME A112.19.2/CSA B45.1',
          'EPA WaterSense Certified',
          'ANSI Z124.4 (Plastic Toilets)',
          'UPC/IPC Compliance',
          'California CEC Compliant',
          'CALGreen Compliant',
          'ADA Compliance (ANSI A117.1)',
          'Buy America(n) Compliance'
        ],
        isEssential: true
      },
      {
        groupName: 'Warranty and Maintenance',
        attributes: [
          'Warranty Period (years)',
          'Commercial Warranty Details',
          'Parts Warranty',
          'Finish Warranty',
          'Maintenance Requirements',
          'Spare Parts Availability'
        ],
        isEssential: true
      }
    ];
  }
  // Mock template for commercial sinks
  else if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
          (fixtureType === 'sink')) {
    
    console.log("Selected commercial sink template for category:", category);
    
    return [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Model Series',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Sink Type (lavatory, kitchen, service, scrub, hand wash)',
          'Mounting Type (undermount, drop-in, wall-mount, pedestal)',
          'Overall Dimensions (LxWxH)',
          'Bowl Dimensions',
          'Bowl Depth',
          'Number of Bowls',
          'Material (stainless steel, vitreous china, solid surface)',
          'Material Gauge (for metal sinks)',
          'Finish/Color',
          'Faucet Holes/Configuration',
          'Drain Size/Type',
          'Weight Capacity',
          'Overflow Drain Included'
        ],
        isEssential: true
      },
      {
        groupName: 'Technical Specifications',
        attributes: [
          'Drain Position',
          'Sound Dampening',
          'Corner Radius',
          'Mounting Hardware Included',
          'Faucet Ledge Width',
          'Backsplash Dimensions (if included)',
          'Soap Dispenser Hole(s)',
          'Water Retention Volume',
          'Hot Water Resistance',
          'Chemical Resistance'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Features',
        attributes: [
          'Antimicrobial Surface',
          'Scratch Resistant Surface',
          'Pre-Drilled Faucet Holes',
          'Integrated Towel Bar',
          'Integrated Soap Dispenser',
          'Waste Disposal Compatible',
          'Bowl Grid/Rack Included',
          'Splash Guard Features',
          'Preassembled Components'
        ],
        isEssential: false
      },
      {
        groupName: 'Installation and Accessibility',
        attributes: [
          'ADA Compliant',
          'Installation Type',
          'Supply Line Requirements',
          'Waste Line Requirements',
          'Support Bracket Requirements',
          'Counter/Wall Construction Requirements',
          'Minimum Cabinet Size',
          'Cutout Template Included'
        ],
        isEssential: true
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASME A112.19.3/CSA B45.4 (Stainless Steel)',
          'ASME A112.19.2/CSA B45.1 (Ceramic)',
          'IAPMO/ANSI Z124.6 (Plastic Sinks)',
          'NSF/ANSI 2 (Food Equipment)',
          'UPC/IPC Compliance',
          'ADA Compliance (ANSI A117.1)',
          'ASSE 1016 (Scald Protection)',
          'Buy America(n) Compliance'
        ],
        isEssential: true
      },
      {
        groupName: 'Warranty and Support',
        attributes: [
          'Warranty Period (years)',
          'Commercial Warranty Details',
          'Finish Warranty',
          'Maintenance Requirements',
          'Recommended Cleaning Products',
          'Spare Parts Availability'
        ],
        isEssential: true
      }
    ];
  }
  // Mock template for pipe fittings
  else if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
           (categoryLower.includes('fitting'))) {
    
    return [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Specification Number',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Material',
          'Connection type',
          'Size/dimension (nominal pipe size)',
          'Pressure rating',
          'Temperature rating',
          'Compatible pipe types',
          'Configuration (elbow, tee, coupling, union, etc.)',
          'Angle (for elbows)',
          'End connections',
          'Lead-free certification',
          'Standards compliance'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Attributes',
        attributes: [
          'Flow characteristics',
          'Corrosion resistance',
          'Chemical compatibility',
          'UV resistance (for outdoor applications)',
          'Insulation compatibility',
          'Sealing method (o-ring, gasket, etc.)',
          'Required tools for installation',
          'Special coating or lining',
          'Electrical conductivity/dielectric properties',
          'Fire rating'
        ],
        isEssential: false
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASME B16 series (various fitting standards)',
          'ASTM material standards (specific to material)',
          'NSF/ANSI 61 (drinking water system components)',
          'NSF/ANSI 372 (lead content)',
          'UL/FM approvals (for fire protection)',
          'Local plumbing codes compliance',
          'Low-lead compliance (California AB 1953, etc.)'
        ],
        isEssential: true
      }
    ];
  }
  
  // Electrical - Division 26
  else if (divisionLower.includes('electrical') || divisionLower.includes('26')) {
    return [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Specification Number',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Voltage rating',
          'Current rating (amps)',
          'Phase (single or three)',
          'Enclosure/housing material',
          'Enclosure/housing rating (NEMA type)',
          'Mounting type',
          'Dimensions',
          'Conductor size range (AWG or kcmil)',
          'Terminal type',
          'Environmental rating (indoor/outdoor)',
          'Operating temperature range'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Attributes',
        attributes: [
          'Short circuit current rating (SCCR)',
          'Energy efficiency rating',
          'Conductor material compatibility',
          'Vibration resistance',
          'Noise level (if applicable)',
          'Heat dissipation',
          'Warranty period',
          'Required accessories',
          'Remote monitoring capability'
        ],
        isEssential: false
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'National Electrical Code (NEC) compliance',
          'NEMA standards',
          'IEEE standards',
          'UL standards',
          'Energy Star compliance (if applicable)',
          'RoHS compliance',
          'Local electrical codes'
        ],
        isEssential: true
      }
    ];
  }
  
  // HVAC - Division 23
  else if (divisionLower.includes('hvac') || divisionLower.includes('23')) {
    return [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Specification Number',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Capacity/output rating (BTU, tons, CFM)',
          'Efficiency rating (SEER, EER, AFUE)',
          'Airflow rate',
          'Static pressure rating',
          'Electrical requirements (volts, phase, amps)',
          'Physical dimensions',
          'Weight',
          'Duct connection size/type',
          'Operating temperature range',
          'Sound rating/noise level (dB)',
          'Refrigerant type (if applicable)'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Attributes',
        attributes: [
          'Control type (BMS, thermostat)',
          'Filtration rating/type',
          'Zoning capability',
          'Variable speed operation',
          'Humidity control',
          'Warranty details',
          'Maintenance requirements',
          'Sound attenuation features',
          'Indoor air quality features',
          'Monitoring/diagnostic capabilities'
        ],
        isEssential: false
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASHRAE standards',
          'AHRI certification',
          'Energy Star compliance',
          'UL listing',
          'Building code compliance',
          'LEED contribution',
          'Local HVAC codes',
          'EPA refrigerant regulations'
        ],
        isEssential: true
      }
    ];
  }
  
  // Default template for other divisions/categories
  return [
    {
      groupName: 'Product Information',
      attributes: [
        'Product Number',
        'Product Name',
        'Product Description',
        'Manufacturer',
        'Model Number'
      ],
      isEssential: true
    },
    {
      groupName: 'Mandatory Attributes',
      attributes: [
        'Material',
        'Dimensions',
        'Weight',
        'Color/Finish',
        'Standards Compliance',
        'Warranty'
      ],
      isEssential: true
    },
    {
      groupName: 'Technical Specifications',
      attributes: [
        'Performance Specifications',
        'Electrical Requirements',
        'Mechanical Properties',
        'Environmental Ratings',
        'Certifications'
      ],
      isEssential: false
    },
    {
      groupName: 'Code and Standards Compliance',
      attributes: [
        'Industry Standards',
        'Building Codes',
        'Safety Certifications',
        'Environmental Compliance',
        'Sustainability Ratings'
      ],
      isEssential: true
    }
  ];
} 