<?
/**
 * An access point for recording clickstream to Google Analytics, and doing
 * some local logging as well.
 * 
 * @author    Erki Suurjaak
 * @created   09.04.2011
 * @modified  11.04.2011
 */
?>
<!DOCTYPE html>
<html>
<head>
	<script type="text/javascript">

	  var _gaq = _gaq || [];
	  _gaq.push(['_setAccount', 'UA-22477321-4']);
	  _gaq.push(['_setDomainName', '.wikinity.cc']);
	  _gaq.push(['_trackPageview']);

	  (function() {
		var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
		ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
		var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
	  })();

	</script>
</head>
<body>
</body>
</html>
<?

flush(); // Send content to browser
$log_filename = "data/clickstream.log";
$ip = $_SERVER["REMOTE_ADDR"];
$timestamp = strftime("%Y-%m-%d %H:%M:%S");
$method = $_SERVER["REQUEST_METHOD"];
$uri = $_SERVER["REQUEST_URI"];
$browser = $_SERVER["HTTP_USER_AGENT"];
$line = "$timestamp\t$ip\t$method $uri\t$browser\n";

$fp = fopen($log_filename, "a");
fwrite($fp, $line);
fclose($fp);

?>
