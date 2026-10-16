/* Shared behavior for archive pages that had no mobile navigation. */
(function(){var header=document.querySelector('[data-sj-common-header]');if(!header)return;var btn=header.querySelector('#menuBtn'),menu=header.querySelector('#menu');if(!btn||!menu)return;
if(document.body.classList.contains('sj-archive')){btn.addEventListener('click',function(){var open=menu.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));});menu.addEventListener('click',function(e){if(e.target.closest('a')){menu.classList.remove('open');btn.setAttribute('aria-expanded','false');}});}
header.querySelectorAll('a[data-draft]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();if(!document.getElementById('toast'))alert(a.dataset.draft+' is coming soon.');});});
})();
