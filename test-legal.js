const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Cargar y probar las rutas legales
try {
  const legalRoutes = require('./routes/legal');
  app.use('/api/legal', legalRoutes);
  console.log('✅ Rutas legales cargadas correctamente');
} catch (error) {
  console.error('❌ Error cargando rutas legales:', error);
}

const PORT = 5004; // Usar un puerto diferente para prueba

app.listen(PORT, () => {
  console.log(`🧪 Servidor de prueba corriendo en puerto ${PORT}`);
  console.log('Prueba los endpoints:');
  console.log(`- http://localhost:${PORT}/api/legal/terminos-condiciones`);
  console.log(`- http://localhost:${PORT}/api/legal/privacidad`);
  console.log(`- http://localhost:${PORT}/api/legal/cookies`);
});