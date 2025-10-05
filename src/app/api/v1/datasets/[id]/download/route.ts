import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);

  const dataset = await prisma.dataset.findUnique({
    where: { id: decoded },
    include: { distributions: true }
  });

  if (!dataset) {
    return Response.json({ error: 'Dataset not found' }, { status: 404 });
  }

  // Return download URLs with proper constraints for ERDDAP
  const downloadLinks = dataset.distributions.map(dist => {
    const url = dist.url;
    let downloadUrl = url;

    // For ERDDAP tabledap/griddap, add basic constraints to make downloads work
    if (dist.accessService === 'ERDDAP') {
      // For tabledap CSV, no additional constraints needed for full download
      if (url.includes('/tabledap/') && url.endsWith('.csv')) {
        downloadUrl = url;
      }
      // For griddap, add subset notation (downloads last time slice)
      else if (url.includes('/griddap/')) {
        // Remove the extension and re-add it (in case it's already there)
        const base = url.replace(/\.(nc|zarr|html|graph)$/, '');

        // For NetCDF/Zarr, just return the base URL - ERDDAP will serve full dataset
        if (url.endsWith('.nc')) {
          downloadUrl = base + '.nc';
        } else if (url.endsWith('.zarr')) {
          downloadUrl = base + '.zarr';
        } else {
          downloadUrl = url;
        }
      }
    }

    return {
      url: downloadUrl,
      originalUrl: url,
      format: dist.format,
      service: dist.accessService,
      size: dist.size,
      description: `Download ${dist.format} via ${dist.accessService}`
    };
  });

  return Response.json({
    dataset: {
      id: dataset.id,
      title: dataset.title
    },
    downloads: downloadLinks
  });
}
