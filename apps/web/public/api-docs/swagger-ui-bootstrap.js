(function () {
  function initializeSwaggerUi() {
    if (!window.SwaggerUIBundle) {
      return;
    }

    window.ui = window.SwaggerUIBundle({
      url: '/api/docs',
      dom_id: '#swagger-ui',
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      deepLinking: true,
      displayOperationId: false,
      supportedSubmitMethods: ['get', 'post', 'put', 'patch', 'delete'],
      presets: [window.SwaggerUIBundle.presets.apis],
    });
  }

  if (document.readyState === 'complete') {
    initializeSwaggerUi();
    return;
  }

  window.addEventListener('load', initializeSwaggerUi, { once: true });
})();
