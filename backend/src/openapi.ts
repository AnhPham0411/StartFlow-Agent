import { DocumentBuilder } from '@nestjs/swagger';

export function openApiConfig() {
  return new DocumentBuilder()
    .setTitle('StartFlow API')
    .setDescription(
      'Corporate-loan multi-agent workflow API. Public events are filtered summaries only.',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ bearerFormat: 'JWT', scheme: 'bearer', type: 'http' }, 'bearer')
    .addApiKey(
      { in: 'header', name: 'x-internal-service-token', type: 'apiKey' },
      'internal-service-token',
    )
    .build();
}
