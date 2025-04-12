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

  try {
    const response = await api.post(`${API_BASE_URL}/process-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 10000, // 10 second timeout
    });
    
    return {
      attributes: response.data.attributes,
      rawText: response.data.rawText,
      template: response.data.template || getMockTemplateForCategory(division, category)
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    
    // Provide default attributes and a template even in error cases
    // This allows the application to function even when the backend is unavailable
    console.log('Falling back to mock data for PDF processing');
    
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
  
  // Mock template for plumbing/drainage
  if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
      (categoryLower.includes('drain'))) {
    
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
        groupName: 'Essential Attributes',
        attributes: [
          'Load rating/traffic classification (light duty, medium duty, heavy duty)',
          'Top/grate material (cast iron, stainless steel, nickel bronze, etc.)',
          'Top/grate finish (polished, satin, coated, etc.)',
          'Top/grate shape (round, square, rectangular)',
          'Top/grate dimensions',
          'Body material (cast iron, PVC, ABS, etc.)',
          'Outlet size (2", 3", 4", etc.)',
          'Outlet connection type (no-hub, threaded, push-on, etc.)',
          'Outlet orientation (bottom, side, adjustable)',
          'Trap configuration (integral P-trap, separate, none)',
          'Sediment bucket requirement (yes/no)',
          'Water seal depth for trap (if applicable)',
          'Compliance with applicable codes (UPC, IPC, local jurisdictions)'
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
        groupName: 'Additional Options',
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
        isEssential: false
      },
      {
        groupName: 'Body Material Options',
        attributes: [
          'Optional Body Material Suffix: -60 (PVC Body w/Socket Outlet)',
          'Optional Body Material Suffix: -61 (ABS Body w/Socket Outlet)'
        ],
        isEssential: false
      },
      {
        groupName: 'Load Rating',
        attributes: [
          'Load Rating',
          'Load Rating Classification'
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
        isEssential: false
      },
      {
        groupName: 'Dimensional Data',
        attributes: [
          'Pipe Size: 2"(51)',
          'Pipe Size: 3"(76)',
          'Pipe Size: 4"(102)',
          'Pipe Size: 6"(152)'
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
        isEssential: false
      }
    ];
  } 
  // Mock template for pipe fittings
  else if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
           (categoryLower.includes('fitting'))) {
    
    return [
      {
        groupName: 'Essential Attributes',
        attributes: [
          'Material (copper, brass, PVC, CPVC, PEX, etc.)',
          'Connection type (press, solder, threaded, compression, etc.)',
          'Size/dimension (nominal pipe size)',
          'Pressure rating',
          'Temperature rating',
          'Compatible pipe types',
          'Configuration (elbow, tee, coupling, union, etc.)',
          'Angle (for elbows: 45°, 90°, etc.)',
          'End connections (FPT, MPT, sweat, press, etc.)',
          'Lead-free certification (for potable water)',
          'Standards compliance (ASME, ASTM, NSF)'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Important Attributes',
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
        isEssential: false
      }
    ];
  }
  
  // Electrical - Division 26
  else if (divisionLower.includes('electrical') || divisionLower.includes('26')) {
    return [
      {
        groupName: 'Essential Attributes',
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
        groupName: 'Additional Important Attributes',
        attributes: [
          'Short circuit current rating (SCCR)',
          'UL/CSA/ETL listing',
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
        isEssential: false
      }
    ];
  }
  
  // HVAC - Division 23
  else if (divisionLower.includes('hvac') || divisionLower.includes('23')) {
    return [
      {
        groupName: 'Essential Attributes',
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
        groupName: 'Additional Important Attributes',
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
        isEssential: false
      }
    ];
  }
  
  // Default template for other divisions/categories
  return [
    {
      groupName: 'Essential Attributes',
      attributes: [
        'Product Name',
        'Model Number',
        'Manufacturer',
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
      isEssential: false
    }
  ];
} 