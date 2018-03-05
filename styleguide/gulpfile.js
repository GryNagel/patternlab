/******************************************************
 * PATTERN LAB NODE
 * EDITION-NODE-GULP
 * The gulp wrapper around patternlab-node core, providing tasks to interact with the core library and move supporting frontend assets.
******************************************************/
var gulp = require('gulp'),
    path = require('path'),
    browserSync = require('browser-sync').create(),
    argv = require('minimist')(process.argv.slice(2)),
    chalk = require('chalk'),
    gulpIgnore = require('gulp-ignore'),
    autoprefixer = require('gulp-autoprefixer'),
    sass = require('gulp-sass')
    sassGlob = require('gulp-sass-glob'),
    plumber = require('gulp-plumber'),  // Errors that don't break streams
    notify = require("gulp-notify"),    // Get better error notifications
    sourcemaps = require('gulp-sourcemaps'),
    svgSprite = require('gulp-svg-sprite'),
    jshint = require('gulp-jshint'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    sassLint = require('gulp-sass-lint'); // Should set up linting rules for sass

/**
 * Normalize all paths to be plain, paths with no leading './',
 * relative to the process root, and with backslashes converted to
 * forward slashes. Should work regardless of how the path was
 * written. Accepts any number of parameters, and passes them along to
 * path.resolve().
 *
 * This is intended to avoid all known limitations of gulp.watch().
 *
 * @param {...string} pathFragment - A directory, filename, or glob.
*/

function normalizePath() {
  return path
    .relative(
      process.cwd(),
      path.resolve.apply(this, arguments)
    )
    .replace(/\\/g, "/");
}

/******************************************************
 * BOUVET TASKS - Custom tasks we put on top of existing PL tasks
 ******************************************************/

// Compile sass/scss
gulp.task('sass-compile', function() {
    return gulp.src(['scss/*.scss'], {cwd: path.resolve(paths().source.css)})
        .pipe(plumber({errorHandler: errorAlert}))
        .pipe(sourcemaps.init())
        .pipe(sassGlob())
        .pipe(sass())
        .pipe(autoprefixer({
            browsers: [
                'ie >= 9',
                'Firefox >= 40',
                'Chrome >= 43',
                'Opera >= 32',
                'Safari >= 8',
                'ChromeAndroid >= 44',
                'iOS >= 8.4'
            ]
        }))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(normalizePath(paths().source.css)))
        .pipe(browserSync.stream());
});

gulp.task('sprite', function() {
    return gulp.src('sprite/*.svg', {cwd: normalizePath(paths().source.images)})
        .pipe(svgSprite({
            shape: {
                spacing: { // Add padding
                    padding: 1
                }
            },
            mode: {
                css: {
                    dest : '../',
                    sprite : 'images/sprite.svg',
                    layout: 'diagonal',
                    dimensions: true,
                    bust: false,
                    render: {
                        scss: {
                            template: 'sprite.scss.mustache',
                            dest: 'css/scss/02-generic/_sprite.scss'
                        }
                    },
                    variables: {
                        now: +new Date()
                    }
                }
            }
        }))
        .on('error', function(error) {
            console.log(error);
        })
        .pipe(gulp.dest(normalizePath(paths().source.css)))
});

function errorAlert(error){
    notify.onError({title: "Build Error", message: "Check your terminal", sound: "Sosumi"})(error); //Error Notification
    console.log('Error in file: ${error.file}:${error.line}');
    console.log('Line:          ', error.line);
    console.log('Column:        ', error.column);
    console.log('Error code:    ', error.status); // used to be "code" in v2x and below
    console.log('Error message:\n',error.messageOriginal);
    this.emit("end"); //End function
};

/******************************************************
 * COPY TASKS - stream assets from source to destination
******************************************************/
// JS copy
gulp.task('pl-copy:js', function () {
  return gulp.src('**/*.js', {cwd: normalizePath(paths().source.js)} )
    .pipe(gulp.dest(normalizePath(paths().public.js)));
});

// Images copy
gulp.task('pl-copy:img', function () {
  return gulp.src('**/*.*',{cwd: normalizePath(paths().source.images)} )
    .pipe(gulp.dest(normalizePath(paths().public.images)));
});

// Favicon copy
gulp.task('pl-copy:favicon', function () {
  return gulp.src('favicon.ico', {cwd: normalizePath(paths().source.root)} )
    .pipe(gulp.dest(normalizePath(paths().public.root)));
});

// Fonts copy
gulp.task('pl-copy:font', function () {
  return gulp.src('*', {cwd: normalizePath(paths().source.fonts)})
    .pipe(gulp.dest(normalizePath(paths().public.fonts)));
});

// CSS Copy
gulp.task('pl-copy:css', function () {
  return gulp.src(normalizePath(paths().source.css) + '/*.css')
    .pipe(gulp.dest(normalizePath(paths().public.css)))
    .pipe(browserSync.stream());
});

// Styleguide Copy everything but css
gulp.task('pl-copy:styleguide', function () {
  return gulp.src(normalizePath(paths().source.styleguide) + '/**/!(*.css)')
    .pipe(gulp.dest(normalizePath(paths().public.root)))
    .pipe(browserSync.stream());
});

// Styleguide Copy and flatten css
gulp.task('pl-copy:styleguide-css', function () {
  return gulp.src(normalizePath(paths().source.styleguide) + '/**/*.css')
    .pipe(gulp.dest(function (file) {
      //flatten anything inside the styleguide into a single output dir per http://stackoverflow.com/a/34317320/1790362
      file.path = path.join(file.base, path.basename(file.path));
      return normalizePath(path.join(paths().public.styleguide, '/css'));
    }))
    .pipe(browserSync.stream());
});

/******************************************************
 * PATTERN LAB CONFIGURATION - API with core library
******************************************************/
//read all paths from our namespaced config file
var config = require('./patternlab-config.json'),
  patternlab = require('patternlab-node')(config);

function paths() {
  return config.paths;
}

function getConfiguredCleanOption() {
  return config.cleanPublic;
}

/**
 * Performs the actual build step. Accomodates both async and sync
 * versions of Pattern Lab.
 * @param {function} done - Gulp done callback
 */
function build(done) {
  const buildResult = patternlab.build(() => {}, getConfiguredCleanOption());

  // handle async version of Pattern Lab
  if (buildResult instanceof Promise) {
    return buildResult.then(done);
  }

  // handle sync version of Pattern Lab
  done();
  return null;
}

gulp.task('pl-assets', gulp.series(
  'pl-copy:js',
  'pl-copy:img',
  'pl-copy:favicon',
  'pl-copy:font',
  'pl-copy:css',
  'pl-copy:styleguide',
  'pl-copy:styleguide-css'
));

gulp.task('patternlab:version', function (done) {
  patternlab.version();
  done();
});

gulp.task('patternlab:help', function (done) {
  patternlab.help();
  done();
});

gulp.task('patternlab:patternsonly', function (done) {
  patternlab.patternsonly(done, getConfiguredCleanOption());
});

gulp.task('patternlab:liststarterkits', function (done) {
  patternlab.liststarterkits();
  done();
});

gulp.task('patternlab:loadstarterkit', function (done) {
  patternlab.loadstarterkit(argv.kit, argv.clean);
  done();
});

gulp.task('patternlab:build', gulp.series('sass-compile' , 'pl-assets', build));

gulp.task('patternlab:installplugin', function (done) {
  patternlab.installplugin(argv.plugin);
  done();
});

/******************************************************
 * SERVER AND WATCH TASKS
******************************************************/
// watch task utility functions
function getSupportedTemplateExtensions() {
  var engines = require('./node_modules/patternlab-node/core/lib/pattern_engines');
  return engines.getSupportedFileExtensions();
}
function getTemplateWatches() {
  return getSupportedTemplateExtensions().map(function (dotExtension) {
    return normalizePath(paths().source.patterns, '**', '*' + dotExtension);
  });
}

/**
 * Reloads BrowserSync.
 * Note: Exits more reliably when used with a done callback.
 */
function reload(done) {
  browserSync.reload();
  done();
}

/**
 * Reloads BrowserSync, with CSS injection.
 * Note: Exits more reliably when used with a done callback.
 */
function reloadCSS(done) {
  browserSync.reload('*.css');
  done();
}

function watch() {
    gulp.watch(path.resolve(paths().source.js, 'src/**/*.js'), { awaitWriteFinish: true }).on('change', gulp.series('pl-copy:js'));
    gulp.watch(path.resolve(paths().source.css, 'scss/**/*.scss'), { awaitWriteFinish: true }).on('change', gulp.series('sass-compile'));
    gulp.watch(path.resolve(paths().source.css, '**/*.css'), { awaitWriteFinish: true }).on('change', gulp.series('pl-copy:css', reloadCSS));
    gulp.watch(path.resolve(paths().source.styleguide, '**/*.*'), { awaitWriteFinish: true }).on('change', gulp.series('pl-copy:styleguide', 'pl-copy:styleguide-css', reloadCSS));

    var patternWatches = [
        path.resolve(paths().source.patterns, '**/*.json'),
        path.resolve(paths().source.patterns, '**/*.md'),
        path.resolve(paths().source.data, '*.json'),
        path.resolve(paths().source.fonts + '/*'),
        path.resolve(paths().source.images + '/*'),
        path.resolve(paths().source.meta, '*'),
        path.resolve(paths().source.annotations + '/*')
    ].concat(getTemplateWatches());

    gulp.watch(patternWatches, { awaitWriteFinish: true }).on('change', gulp.series(build, reload));
}

gulp.task('patternlab:connect', gulp.series(function (done) {
  browserSync.init({
    server: {
      baseDir: normalizePath(paths().public.root)
    },
    snippetOptions: {
      // Ignore all HTML files within the templates folder
      blacklist: ['/index.html', '/', '/?*']
    },
    notify: {
      styles: [
        'display: none',
        'padding: 15px',
        'font-family: sans-serif',
        'position: fixed',
        'font-size: 1em',
        'z-index: 9999',
        'bottom: 0px',
        'right: 0px',
        'border-top-left-radius: 5px',
        'background-color: #1B2032',
        'opacity: 0.4',
        'margin: 0',
        'color: white',
        'text-align: center'
      ]
    }
  }, function () {
    done();
  });
}));

/******************************************************
 * COMPOUND TASKS
******************************************************/
gulp.task('default', gulp.series('patternlab:build'));
gulp.task('patternlab:watch', gulp.series('patternlab:build', watch));
gulp.task('patternlab:serve', gulp.series('patternlab:build', 'patternlab:connect', watch));

/******************************************************
 * CUSTOM TASKS
 ******************************************************/
gulp.task('serve', gulp.series('patternlab:serve'));