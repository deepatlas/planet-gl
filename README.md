# planet-gl
Build a model of the earth with WebGL, experiment and have fun*

Live on Github pages: https://deepatlas.github.io/planet-gl/

## Development

Hot deployment

    npm start

## Deployment

    npm run build
    npm run deploy

## View page with Jekyll

If you want to view the page as it's deployed on Github pages:

Update and run bundler 

    gem update bundler
    bundle install

Jekyll configuration is stored in `_config.yml`

Build and run the website with Jekyll 

    npm run build
    bundle exec jekyll serve

Open http://127.0.0.1:4000/assets/




Ideas taken from
- Paul West (west77.ru): https://codepen.io/prisoner849/pen/PvdEMP


***inspired by [a talk of Douglas Adams](https://www.youtube.com/watch?v=8UNG3cQoOEc&t=3090)**