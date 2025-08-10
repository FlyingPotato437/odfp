import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // Sample NOAA datasets based on real ones
    const sampleDatasets = [
      {
        id: "noaa-sample-sst-1",
        title: "NOAA/NCEI Global Sea Surface Temperature (SST) Analysis",
        abstract: "The NOAA Global Sea Surface Temperature (SST) analysis provides daily SST data at 1/4 degree resolution. The analysis is produced using optimal interpolation (OI) of satellite SST observations from the Advanced Very High Resolution Radiometer (AVHRR).",
        publisher: "NOAA National Centers for Environmental Information",
        timeStart: new Date("2020-01-01"),
        timeEnd: new Date("2024-12-31"),
        bboxMinX: -180.0,
        bboxMinY: -90.0,
        bboxMaxX: 180.0,
        bboxMaxY: 90.0,
        sourceSystem: "Sample",
        keywords: JSON.stringify(["ocean temperature", "sea surface temperature", "SST", "satellite"]),
        variables: {
          create: [
            {
              name: "sea_surface_temperature",
              standardName: "sea_surface_temperature",
              units: "kelvin",
              longName: "Sea Surface Temperature"
            },
            {
              name: "analysis_error", 
              standardName: "sea_surface_temperature_analysis_error",
              units: "kelvin",
              longName: "Analysis Error"
            }
          ]
        },
        distributions: {
          create: [
            {
              url: "https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/",
              accessService: "HTTP",
              format: "NetCDF"
            },
            {
              url: "https://www.ncei.noaa.gov/thredds/dodsC/OisstBase/NetCDF/V2.1/AVHRR/",
              accessService: "OPeNDAP", 
              format: "NetCDF"
            }
          ]
        }
      },
      {
        id: "noaa-sample-wind-1", 
        title: "NOAA/NCEP Global Forecast System (GFS) Wind Data",
        abstract: "The Global Forecast System (GFS) is a weather forecast model produced by the National Centers for Environmental Prediction (NCEP). This dataset contains global wind speed and direction forecasts at multiple atmospheric levels.",
        publisher: "NOAA National Centers for Environmental Prediction",
        timeStart: new Date("2019-01-01"),
        timeEnd: new Date("2024-12-31"),
        bboxMinX: -180.0,
        bboxMinY: -90.0, 
        bboxMaxX: 180.0,
        bboxMaxY: 90.0,
        sourceSystem: "Sample",
        keywords: JSON.stringify(["wind", "forecast", "atmospheric", "meteorology"]),
        variables: {
          create: [
            {
              name: "eastward_wind",
              standardName: "eastward_wind",
              units: "m s-1",
              longName: "Eastward Wind Component"
            },
            {
              name: "northward_wind",
              standardName: "northward_wind", 
              units: "m s-1",
              longName: "Northward Wind Component"
            }
          ]
        },
        distributions: {
          create: [
            {
              url: "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/",
              accessService: "HTTP",
              format: "GRIB2"
            }
          ]
        }
      },
      {
        id: "noaa-sample-tide-1",
        title: "NOAA Tides and Currents Station Data", 
        abstract: "Real-time and historical water levels, meteorological data, and oceanographic data collected from NOAA's network of observing stations around the US coastlines, Great Lakes, and Pacific and Caribbean territories.",
        publisher: "NOAA Center for Operational Oceanographic Products and Services",
        timeStart: new Date("1900-01-01"),
        timeEnd: new Date("2024-12-31"),
        bboxMinX: -180.0,
        bboxMinY: 15.0,
        bboxMaxX: -60.0, 
        bboxMaxY: 72.0,
        sourceSystem: "Sample",
        keywords: JSON.stringify(["water level", "tides", "currents", "coastal", "stations"]),
        variables: {
          create: [
            {
              name: "water_level",
              standardName: "sea_surface_height_above_sea_level",
              units: "meters",
              longName: "Water Level"
            },
            {
              name: "air_pressure",
              standardName: "air_pressure_at_sea_level",
              units: "mb",
              longName: "Air Pressure"
            }
          ]
        },
        distributions: {
          create: [
            {
              url: "https://tidesandcurrents.noaa.gov/api/",
              accessService: "HTTP",
              format: "JSON"
            },
            {
              url: "https://tidesandcurrents.noaa.gov/api/",
              accessService: "HTTP", 
              format: "CSV"
            }
          ]
        }
      },
      {
        id: "noaa-sample-climate-1",
        title: "NOAA Climate Data Online - Daily Weather Summaries",
        abstract: "Daily weather observations from thousands of land-based weather stations across the United States including temperature, precipitation, wind, and other meteorological variables from the Global Historical Climatology Network.",
        publisher: "NOAA National Centers for Environmental Information",
        timeStart: new Date("1763-01-01"),
        timeEnd: new Date("2024-12-31"), 
        bboxMinX: -180.0,
        bboxMinY: 15.0,
        bboxMaxX: -60.0,
        bboxMaxY: 72.0,
        sourceSystem: "Sample",
        keywords: JSON.stringify(["climate", "temperature", "precipitation", "weather stations", "daily"]),
        variables: {
          create: [
            {
              name: "air_temperature_maximum",
              standardName: "air_temperature",
              units: "celsius", 
              longName: "Maximum Air Temperature"
            },
            {
              name: "air_temperature_minimum",
              standardName: "air_temperature",
              units: "celsius",
              longName: "Minimum Air Temperature"
            },
            {
              name: "precipitation_amount",
              standardName: "precipitation_amount",
              units: "mm",
              longName: "Precipitation Amount"
            }
          ]
        },
        distributions: {
          create: [
            {
              url: "https://www.ncei.noaa.gov/data/daily-summaries/access/",
              accessService: "HTTP",
              format: "CSV"
            },
            {
              url: "https://www.ncei.noaa.gov/cdo-web/api/v2/",
              accessService: "HTTP",
              format: "JSON"
            }
          ]
        }
      },
      {
        id: "noaa-sample-satellite-1",
        title: "NOAA-20 VIIRS Sea Surface Temperature",
        abstract: "Sea Surface Temperature (SST) products derived from the Visible Infrared Imaging Radiometer Suite (VIIRS) aboard the NOAA-20 satellite. Provides global SST measurements with high spatial and temporal resolution for oceanographic and climate studies.", 
        publisher: "NOAA National Environmental Satellite Data and Information Service",
        timeStart: new Date("2017-11-28"),
        timeEnd: new Date("2024-12-31"),
        bboxMinX: -180.0,
        bboxMinY: -90.0,
        bboxMaxX: 180.0,
        bboxMaxY: 90.0,
        sourceSystem: "Sample",
        keywords: JSON.stringify(["satellite", "VIIRS", "sea surface temperature", "NOAA-20", "remote sensing"]),
        variables: {
          create: [
            {
              name: "sea_surface_temperature",
              standardName: "sea_surface_temperature", 
              units: "kelvin",
              longName: "Sea Surface Temperature"
            },
            {
              name: "quality_level",
              standardName: null,
              units: "1",
              longName: "SST Quality Level"
            }
          ]
        },
        distributions: {
          create: [
            {
              url: "https://www.star.nesdis.noaa.gov/socd/sst/squam/data/",
              accessService: "HTTP",
              format: "NetCDF"
            },
            {
              url: "https://coastwatch.pfeg.noaa.gov/erddap/griddap/",
              accessService: "ERDDAP",
              format: "NetCDF"
            }
          ]
        }
      }
    ];

    let created = 0;
    for (const dataset of sampleDatasets) {
      try {
        await prisma.dataset.upsert({
          where: { id: dataset.id },
          create: dataset,
          update: {
            title: dataset.title,
            abstract: dataset.abstract,
            publisher: dataset.publisher,
            timeStart: dataset.timeStart,
            timeEnd: dataset.timeEnd,
            bboxMinX: dataset.bboxMinX,
            bboxMinY: dataset.bboxMinY,
            bboxMaxX: dataset.bboxMaxX,
            bboxMaxY: dataset.bboxMaxY,
            keywords: dataset.keywords
          }
        });
        created++;
      } catch (error) {
        console.error(`Failed to create dataset ${dataset.id}:`, error);
      }
    }

    return Response.json({ 
      ok: true, 
      message: `Created ${created} sample datasets`, 
      created 
    });

  } catch (error) {
    console.error("Failed to seed sample data:", error);
    return Response.json({ 
      ok: false, 
      error: "Failed to seed sample data",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}