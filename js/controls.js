var hideMusic = true;
circle.addEventListener("click", function() {
  if (hideMusic) {
    circle.style.background = "#dd00dd";
    circle.style.color = "#dd00dd";
    info.style.width = "640px";
    info.style.height = "360px";
  } else {
    circle.style.background = "#7c367c";
    circle.style.color = "#dd00dd";
    info.style.width = "62px";
    info.style.height = "62px";
  }
  hideMusic = !hideMusic;
}, false);
