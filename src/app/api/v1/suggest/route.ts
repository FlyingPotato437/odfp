import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const prefix = (url.searchParams.get("prefix") || "").toLowerCase();

  let items: string[] = [];
  if (type === "variable") {
    // Return curated oceanographic variables for better user experience
    const oceanographicVars = [
      'sea_surface_temperature',
      'sea_water_temperature', 
      'sea_water_salinity',
      'chlorophyll_concentration',
      'wave_height',
      'significant_wave_height',
      'sea_surface_height',
      'sea_water_pressure',
      'current_speed',
      'current_direction',
      'water_level',
      'tide_height',
      'sea_ice_concentration',
      'sea_floor_depth',
      'ocean_mixed_layer_depth',
      'sea_water_density',
      'sea_water_ph',
      'dissolved_oxygen',
      'turbidity',
      'sea_water_turbidity',
      // Paleo proxies
      "δ18O", "d18O", "oxygen isotope", "Uk'37", "UK37", "U37K'", "alkenone", "TEX86", "Mg/Ca"
    ];
    
    // Get unique variables from database to supplement the list
    const vars = await prisma.variable.findMany({ 
      select: { standardName: true, name: true },
      where: {
        AND: [
          {
            OR: [
              { standardName: { contains: 'sea_' } },
              { standardName: { contains: 'ocean_' } },
              { standardName: { contains: 'marine_' } },
              { name: { contains: 'temperature' } },
              { name: { contains: 'salinity' } },
              { name: { contains: 'current' } },
              { name: { contains: 'wave' } },
              { name: { contains: 'chlorophyll' } }
            ]
          },
          {
            NOT: {
              OR: [
                { standardName: { contains: 'air_' } },
                { standardName: { contains: 'atmosphere' } },
                { name: { contains: 'air_' } },
                { name: { contains: 'atmosphere' } }
              ]
            }
          }
        ]
      }
    });
    
    const dbOceanVars = new Set<string>();
    for (const v of vars) {
      const varName = (v.standardName || v.name);
      if (varName) dbOceanVars.add(varName);
    }
    
    // Combine curated variables with database ocean variables, remove duplicates
    const allOceanVars = new Set([...oceanographicVars, ...Array.from(dbOceanVars)]);
    items = Array.from(allOceanVars);
  } else if (type === "publisher") {
    const pubs = await prisma.dataset.findMany({ select: { publisher: true }, where: { publisher: { not: null } } });
    const set = new Set<string>();
    for (const p of pubs) if (p.publisher) set.add(p.publisher.toLowerCase());
    items = Array.from(set);
  } else if (type === "platform") {
    const rows = await prisma.dataset.findMany({ select: { platforms: true } });
    const set = new Set<string>();
    for (const r of rows as Array<{ platforms: unknown }>) {
      const list = Array.isArray(r.platforms) ? (r.platforms as string[]) : [];
      for (const p of list) set.add(String(p).toLowerCase());
    }
    items = Array.from(set);
  } else {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }

    const filtered = items
    .filter((x) => prefix ? x.startsWith(prefix) : true)
    .sort((a, b) => {
      // Prioritize ocean and paleo-related variables
      const aIsOcean = a.includes('sea_') || a.includes('ocean_') || a.includes('marine_') || a.includes('chlorophyll') || a.includes('wave_') || a.includes('current_');
      const bIsOcean = b.includes('sea_') || b.includes('ocean_') || b.includes('marine_') || b.includes('chlorophyll') || b.includes('wave_') || b.includes('current_');
      const aIsPaleo = /(?:δ|d)\s*?18\s*?o/i.test(a) || /uk['′’]?\s*37|u37k['′’]?/i.test(a) || a.toLowerCase().includes('oxygen isotope') || a.toLowerCase().includes('alkenone');
      const bIsPaleo = /(?:δ|d)\s*?18\s*?o/i.test(b) || /uk['′’]?\s*37|u37k['′’]?/i.test(b) || b.toLowerCase().includes('oxygen isotope') || b.toLowerCase().includes('alkenone');
      
      if ((aIsOcean || aIsPaleo) && !(bIsOcean || bIsPaleo)) return -1;
      if (!(aIsOcean || aIsPaleo) && (bIsOcean || bIsPaleo)) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 10);

  return Response.json({ items: filtered });
}

