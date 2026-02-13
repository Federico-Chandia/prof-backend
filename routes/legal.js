const express = require('express');
const router = express.Router();

// Cargar documentos legales con manejo de errores
let TERMINOS_Y_CONDICIONES_PROFESIONALES = '';
let POLITICA_PRIVACIDAD_PROFESIONALES = '';
let POLITICA_COOKIES_PROFESIONALES = '';

try {
  const legalDocs = require('../utils/legalDocuments');
  TERMINOS_Y_CONDICIONES_PROFESIONALES = legalDocs.TERMINOS_Y_CONDICIONES_PROFESIONALES || '';
  POLITICA_PRIVACIDAD_PROFESIONALES = legalDocs.POLITICA_PRIVACIDAD_PROFESIONALES || '';
  POLITICA_COOKIES_PROFESIONALES = legalDocs.POLITICA_COOKIES_PROFESIONALES || '';
  console.log('✅ Documentos legales cargados exitosamente');
} catch (error) {
  console.error('❌ Error cargando documentos legales:', error);
}

/**
 * @route GET /api/legal/terminos-condiciones
 * @desc Obtener términos y condiciones para profesionales
 * @access Public
 */
router.get('/terminos-condiciones', (req, res) => {
  try {
    if (!TERMINOS_Y_CONDICIONES_PROFESIONALES) {
      return res.status(503).json({
        error: 'Documento no disponible',
        message: 'Los términos y condiciones no están disponibles en este momento'
      });
    }
    
    res.json({
      titulo: 'Términos y Condiciones para Profesionales',
      contenido: TERMINOS_Y_CONDICIONES_PROFESIONALES,
      version: '1.0',
      fechaActualizacion: '2026-01-31',
      tipo: 'terminos'
    });
  } catch (error) {
    console.error('Error en /terminos-condiciones:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: 'No se pudo obtener el documento'
    });
  }
});

/**
 * @route GET /api/legal/privacidad
 * @desc Obtener política de privacidad
 * @access Public
 */
router.get('/privacidad', (req, res) => {
  try {
    if (!POLITICA_PRIVACIDAD_PROFESIONALES) {
      return res.status(503).json({
        error: 'Documento no disponible',
        message: 'La política de privacidad no está disponible en este momento'
      });
    }
    
    res.json({
      titulo: 'Política de Privacidad',
      contenido: POLITICA_PRIVACIDAD_PROFESIONALES,
      version: '1.0',
      fechaActualizacion: '2026-01-31',
      tipo: 'privacidad'
    });
  } catch (error) {
    console.error('Error en /privacidad:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: 'No se pudo obtener el documento'
    });
  }
});

/**
 * @route GET /api/legal/cookies
 * @desc Obtener política de cookies
 * @access Public
 */
router.get('/cookies', (req, res) => {
  try {
    if (!POLITICA_COOKIES_PROFESIONALES) {
      return res.status(503).json({
        error: 'Documento no disponible',
        message: 'La política de cookies no está disponible en este momento'
      });
    }
    
    res.json({
      titulo: 'Política de Cookies',
      contenido: POLITICA_COOKIES_PROFESIONALES,
      version: '1.0',
      fechaActualizacion: '2026-01-31',
      tipo: 'cookies'
    });
  } catch (error) {
    console.error('Error en /cookies:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: 'No se pudo obtener el documento'
    });
  }
});

/**
 * @route GET /api/legal/all
 * @desc Obtener todos los documentos legales
 * @access Public
 */
/**
 * @route GET /api/legal/view/:type
 * @desc Obtener documento legal formateado como HTML para visualización
 * @access Public
 */
router.get('/view/:type', (req, res) => {
  try {
    const { type } = req.params;
    
    let titulo = '';
    let contenido = '';
    let docType = '';
    
    switch(type) {
      case 'terminos-condiciones':
        titulo = 'Términos y Condiciones para Profesionales';
        contenido = TERMINOS_Y_CONDICIONES_PROFESIONALES;
        docType = 'terminos';
        break;
      case 'privacidad':
        titulo = 'Política de Privacidad';
        contenido = POLITICA_PRIVACIDAD_PROFESIONALES;
        docType = 'privacidad';
        break;
      case 'cookies':
        titulo = 'Política de Cookies';
        contenido = POLITICA_COOKIES_PROFESIONALES;
        docType = 'cookies';
        break;
      default:
        return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    if (!contenido) {
      return res.status(503).json({
        error: 'Documento no disponible',
        message: 'El documento solicitado no está disponible en este momento'
      });
    }
    
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${titulo}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          padding: 20px;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          background-color: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #1f2937;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 10px;
          margin-bottom: 30px;
        }
        h2, h3 {
          color: #374151;
          margin-top: 25px;
          margin-bottom: 10px;
        }
        p {
          margin: 10px 0;
          text-align: justify;
        }
        ul, ol {
          margin: 15px 0;
          padding-left: 30px;
        }
        li {
          margin: 8px 0;
        }
        .content {
          margin-bottom: 30px;
          min-height: 300px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
          text-align: center;
        }
        .version-info {
          background-color: #f3f4f6;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 14px;
          color: #6b7280;
        }
        .buttons {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin-top: 30px;
          padding: 20px;
          background-color: #f9fafb;
          border-radius: 8px;
          border-top: 1px solid #e5e7eb;
        }
        button {
          padding: 12px 32px;
          font-size: 16px;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .accept-btn {
          background-color: #2563eb;
          color: white;
        }
        .accept-btn:hover {
          background-color: #1d4ed8;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .accept-btn:active {
          transform: scale(0.98);
        }
        .close-btn {
          background-color: #e5e7eb;
          color: #374151;
        }
        .close-btn:hover {
          background-color: #d1d5db;
        }
        .success-message {
          display: none;
          margin-top: 20px;
          padding: 15px;
          background-color: #d1fae5;
          border: 1px solid #6ee7b7;
          border-radius: 6px;
          color: #065f46;
          text-align: center;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${titulo}</h1>
        <div class="version-info">
          <strong>Versión:</strong> 1.0 | <strong>Última actualización:</strong> 31 de enero de 2026
        </div>
        <div class="content" style="white-space: pre-wrap; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${contenido.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
        <div class="footer">
          <p>Este documento es válido conforme a la legislación de Buenos Aires, Argentina</p>
          <p>© 2026 Plataforma Profesionales. Todos los derechos reservados.</p>
        </div>
        
        <div class="buttons">
          <button class="accept-btn" onclick="acceptDocument('${docType}')">✓ Aceptar</button>
          <button class="close-btn" onclick="window.close()">Cerrar</button>
        </div>
        <div class="success-message" id="successMessage">
          ✓ Documento aceptado correctamente. Puedes cerrar esta pestaña.
        </div>
      </div>

      <script>
        function acceptDocument(docType) {
          try {
            // Si fue abierto desde otra ventana, enviar mensaje al padre
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({
                type: 'LEGAL_DOCUMENT_ACCEPTED',
                docType: docType
              }, '*');
            }
            
            // También guardar localmente si es posible
            try {
              const accepted = JSON.parse(localStorage.getItem('legalAcceptance') || '{}');
              accepted[docType] = true;
              localStorage.setItem('legalAcceptance', JSON.stringify(accepted));
            } catch (e) {
              console.warn('localStorage no disponible:', e);
            }
            
            // Mostrar mensaje de éxito
            document.getElementById('successMessage').style.display = 'block';
            
            // Cerrar la pestaña después de 1500ms
            setTimeout(() => {
              window.close();
            }, 1500);
          } catch (error) {
            console.error('Error al aceptar documento:', error);
            alert('Error al procesar tu aceptación. Por favor intenta nuevamente.');
          }
        }

        // Escuchar mensajes desde otra ventana (backup)
        window.addEventListener('message', function(event) {
          if (event.data.type === 'REQUEST_LEGAL_STATUS') {
            const accepted = JSON.parse(localStorage.getItem('legalAcceptance') || '{}');
            event.source.postMessage({
              type: 'LEGAL_STATUS_RESPONSE',
              data: accepted
            }, event.origin);
          }
        });
      </script>
    </body>
    </html>
    `;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  } catch (error) {
    console.error('Error en /view/:type:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; color: #d32f2f; padding: 20px; }
        </style>
      </head>
      <body>
        <h1>Error al cargar el documento</h1>
        <p>No se pudo obtener el documento solicitado. Por favor, intenta nuevamente más tarde.</p>
      </body>
      </html>
    `);
  }
});

router.get('/all', (req, res) => {
  try {
    res.json({
      terminos: {
        titulo: 'Términos y Condiciones para Profesionales',
        contenido: TERMINOS_Y_CONDICIONES_PROFESIONALES,
        version: '1.0',
        fechaActualizacion: '2026-01-31',
        tipo: 'terminos'
      },
      privacidad: {
        titulo: 'Política de Privacidad',
        contenido: POLITICA_PRIVACIDAD_PROFESIONALES,
        version: '1.0',
        fechaActualizacion: '2026-01-31',
        tipo: 'privacidad'
      },
      cookies: {
        titulo: 'Política de Cookies',
        contenido: POLITICA_COOKIES_PROFESIONALES,
        version: '1.0',
        fechaActualizacion: '2026-01-31',
        tipo: 'cookies'
      }
    });
  } catch (error) {
    console.error('Error en /all:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: 'No se pudieron obtener los documentos'
    });
  }
});

module.exports = router;
