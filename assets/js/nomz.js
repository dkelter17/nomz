function main(document) {
  interactiveChecklists(document)
}

function interactiveChecklists(document) {
  const checkboxes = document.querySelectorAll(".task-list .task-list-item-checkbox")
  if (checkboxes && checkboxes.length > 0) {
    checkboxes.forEach((el) => el.removeAttribute("disabled"))
  }
}


(function(document){
  document.addEventListener('readystatechange', (event) => {
    if (document.readyState === 'complete') {
      main(document)
    }
  });
})(document)