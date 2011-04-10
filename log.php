<?
/**
 * Initially just an access point for logging calls to Apache logs, more     
 * extensive logging can be added later.
 * 
 * @author    Erki Suurjaak
 * @created   09.04.2011
 * @modified  09.04.2011
 */

?>
<!DOCTYPE html>
<html>
<head>
  <script type="text/javascript">
    // Google Analytics
    var _gaq = _gaq || [];
    _gaq.push(['_setAccount', 'UA-22477321-3']);
    _gaq.push(['_trackPageview']);
    (function() {
      var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
      ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
      var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
    })();
  </script>
</head>
<body>
["Success"]<? var_dump($_SERVER); ?>
<body>
</html>
