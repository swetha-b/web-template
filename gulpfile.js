'use strict';

var gulp = require('gulp');

// load plugins
var $ = require('gulp-load-plugins')({
  pattern: [
    'gulp-*',
    'main-bower-files',
    'browser-sync',
    'jshint-stylish',
    'merge-stream',
    'wiredep'
  ]
});

var paths = {
  app: 'src/',
  bower: 'src/libs/',
  tmp: '.tmp/',
  viewsFolder: 'template/',
  dist: 'dist/',
  test: 'test/'
};


var onError = function (err) {
  $.util.log($.util.colors.red(err));
};

gulp.task('styles', function () {
  return gulp.src(paths.app + 'styles/{,*/}*.scss')
      .pipe($.plumber(onError))
      .pipe($.rubySass({
        style: 'expanded',
        precision: 10,
        loadPath: [
          paths.app + 'styles/',
          paths.bower + 'bootstrap-sass-official/assets/stylesheets/'
        ]
      }))
      .pipe($.autoprefixer('last 2 versions'))
      .pipe(gulp.dest(paths.tmp + 'styles/'))
      .pipe($.filter('**/*.css'))
      .pipe($.browserSync.reload({stream:true}))
      .pipe($.size());
});

gulp.task('scripts', function () {
  return gulp.src([
        paths.app + 'scripts/**/*.js',
        'gulpfile.js',
        paths.test + '**/*.js'])
      .pipe($.cached('js'))
      .pipe($.jshint())
      .pipe($.jshint.reporter($.jshintStylish))
      .pipe($.size());
});

gulp.task('html', ['styles', 'scripts', 'wiredep'], function () {
  var jsFilter = $.filter('**/*.js'),
      htmlFilter = $.filter('*.html'),
      cssFilter = $.filter('**/*.css');

  /**
   * FIXME: Temporarily replacing csso with minifyCss due to an issue
   * https://github.com/css/csso/issues/214
   *
   * Use csso once this has been resolved
   * */
  return gulp.src(paths.app + '*.html', {cwd: '.'})
      .pipe($.using())
      .pipe($.useref.assets({searchPath: '{.tmp,src}'}))

      .pipe($.rev())
      .pipe(jsFilter)
      .pipe($.uglify())
      .pipe(jsFilter.restore())
      .pipe(cssFilter)
      .pipe($.minifyCss())
      .pipe(cssFilter.restore())
      .pipe($.useref.restore())
      .pipe($.useref())
      .pipe($.revReplace())
      .pipe(htmlFilter)
      .pipe($.minifyHtml({
        empty: true,
        spare: true,
        quotes: true,
        comments: true
      }))
      .pipe(htmlFilter.restore())
      .pipe(gulp.dest(paths.dist))
      .pipe($.size());
});

// inject bower components
gulp.task('wiredep', function () {
  var wiredep = require('wiredep').stream;

  return gulp.src(paths.app + '*.html')
      .pipe($.plumber(onError))
      .pipe(wiredep({
        directory: paths.bower
      }))
      .pipe(gulp.dest(paths.app));
});

gulp.task('clear', function (done) {
  return $.cache.clearAll(done);
});

gulp.task('clean', function () {
  return gulp.src([paths.tmp, paths.dist], {read: false})
      .pipe($.clean());
});

gulp.task('extras', function () {
  return gulp.src([paths.app + '*.*',
        paths.app + 'template/**/*',
        '!'+ paths.app + '/*.{html,manifest}'], { base: paths.app, dot: true })
      .pipe(gulp.dest(paths.dist));
});

gulp.task('images', function () {
  return gulp.src(paths.app + 'img/**/*.{png,jpg,jpeg,gif}')
      //.pipe($.cache($.imagemin({
      //  optimizationLevel: 3,
      //  progressive: true,
      //  interlaced: true
      //})))
      .pipe(gulp.dest(paths.dist + 'img/'))
      .pipe($.size());
});

gulp.task('fonts', function () {
  var fileStream = $.mergeStream(
      gulp.src($.mainBowerFiles()),
      gulp.src(paths.app + 'fonts/*'));

  return fileStream
      .pipe($.filter('**/*.{eot,svg,ttf,woff}'))
      .pipe($.flatten())
      .pipe(gulp.dest(paths.dist + 'fonts/'))
      .pipe($.size());
});

gulp.task('build', ['html', 'images', 'fonts', 'extras']);


gulp.task('default', ['clean', 'clear'], function () {
  gulp.start('build');
});

function browserSyncInit(baseDir, files, browser, open) {
  browser = browser === undefined ? 'default' : browser;
  open = open === undefined ? 'local' : open;

  $.browserSync.instance = $.browserSync.init(files, {
    server: {
      baseDir: baseDir
    },
    port: 8000,
    browser: browser,
    open: open
  });

}

gulp.task('server', ['watch'], function() {
  browserSyncInit([
    paths.app,
    paths.tmp
  ], [
    paths.app + 'images/**/*',
    paths.app + '*.html',
    paths.app + 'partials/**/*.html',
    paths.app + 'scripts/**/*.js'
  ]);
});

gulp.task('server:dist', ['default', 'watch'], function() {
  browserSyncInit([
    paths.dist
  ], [
    paths.dist + 'images/**/*',
    paths.dist + '*.html',
    paths.dist + 'template/*.html',
    paths.dist + 'scripts/**/*.js'
  ]);
});

gulp.task('server:e2e', function () {
  browserSyncInit([
    paths.app,
    paths.tmp
  ], null, null, false);
});

gulp.task('watch', ['wiredep', 'scripts', 'styles'], function () {
  gulp.watch(paths.app + 'styles/**/*.scss', ['styles']);
  gulp.watch('bower.json', ['wiredep']);
});

// Downloads the selenium webdriver
/* jshint camelcase:false */
gulp.task('webdriver-update', $.protractor.webdriver_update);

gulp.task('webdriver-standalone', $.protractor.webdriver_standalone);

gulp.task('protractor', ['webdriver-update'], function (done) {
  var testFiles = [
    paths.test + 'e2e/**/*.js'
  ];

  gulp.src(testFiles)
      .pipe($.protractor.protractor({
        configFile: paths.test + 'protractor.conf.js'
      }))
      .on('error', function (err) {
        // Make sure failed tests cause gulp to exit non-zero
        throw err;
      })
      .on('end', function () {
        // Close browser sync server
        $.browserSync.exit();
        done();
      });
});

gulp.task('test:e2e', ['protractor']);
