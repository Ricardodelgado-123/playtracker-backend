const scanner = require('sonarqube-scanner').default;

scanner(
  {
    serverUrl: 'http://localhost:9000',
    options: {
      'sonar.login': 'sqp_87926cb0d4615d531934f287ea6c17e352bff88a',
      'sonar.projectKey': 'playtracker',
      'sonar.sources': 'src',
      'sonar.tests': '__tests__',
      'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info'
    }
  },
  () => process.exit()
);