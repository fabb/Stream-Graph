<?php
//$url = $_GET['url'];  
$url = 'https://tiss.tuwien.ac.at/statistik/public_lehre/aktive_studierende_nach_nationalitaet';
$htmlTissData = getTissData($url);
$semesterData = getSemesterData($htmlTissData);

//Starting to extract data 
foreach ($semesterData as $semesterData) {
  $url = 'https://tiss.tuwien.ac.at/statistik/public_lehre/aktive_studierende_nach_nationalitaet/'.$semesterData[1];
  $htmlContent = getTissData($url);
  $content[$semesterData[0]] = createDataTable($htmlContent);
} 
$result = array();
foreach ($content as $term => $countries) {  // $key = semester, $value = länderarray
  foreach ($countries as $key => $value) {   // $key = land, $result[$key][$term]=$value; 
      if(!isset($result[$key])) {
        $result[$key] = array();   
   }
      $result[$key][] = array(strip_tags($term), strip_tags($value));
  } 
}

$fh = fopen('data.xml', 'w');
fwrite($fh, 
'<?xml version="1.0" encoding="utf-8"?>
<!--
Barbara Csarman, Fabian Ehrentraud, 2011
-->
<datasets>
  <title>Studierende pro Nationalitaet</title>
  <x_axis>Semester</x_axis>
  <y_axis>Laender</y_axis>
'
);
foreach ($result as $country => $points) {
 $country = strip_tags($country);
 fwrite($fh, "<dataset><title>$country</title>\n");

 foreach ($points as $point) {
    fwrite($fh, "<point><x_value>".$point[0]."</x_value><y_value>".$point[1]."</y_value></point>\n");
 }
 fwrite($fh, "</dataset>\n");
}
fwrite($fh, '</datasets>');
fclose($fh);
/**
$result = array();
$dataset=0;
foreach ($content as $term => $countries) {  // $key = semester, $value = länderarray
  foreach ($countries as $key => $value) {   // $key = land, $result[$key][$term]=$value; 
    //echo $key;
    echo array_search(strip_tags($key), $result);

    //if(in_array($key, $result)){
      
      //echo "Der Wert ".$key." existiert bereits in resultset";
      //$datasetkey = array_search($key, $result);
      //echo $datasetkey.'<br />';
      
      //$result[$datasetkey]['point']['x_value'] = strip_tags($term);
      //$result[$datasetkey]['point']['y_value'] = strip_tags($value);
    //}
    //else {
      $result[$dataset]['title'] = $key; //countryname
      $result[$dataset]['point']['x_value'] = strip_tags($term);
      $result[$dataset]['point']['y_value'] = strip_tags($value);
      $dataset++;
    //}
  } 
}
print('<pre>');
print_r($result);
print('</pre>');

try {
  $xml = new arrayToXML('datasets');
  $xml->createNode( $result, null );
  $xml->__toString();
} catch (Exception $e) { echo $e->getMessage(); }
**/
/*************************************************************************************************************************************/
function getTissData ($url){
  //Get third party page data
  $curl = curl_init();
  $headers = array("Content-type: application/xml; charset=UTF-8", "Accept: application/xml; charset=UTF-8");
  curl_setopt($curl, CURLOPT_URL, $url);
  curl_setopt($curl,  CURLOPT_RETURNTRANSFER, true);
  curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
  curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
  curl_exec($curl);
  $results = curl_multi_getcontent($curl);
  curl_close($curl);
  if(mb_detect_encoding($results) != 'UTF-8') { $results = utf8_encode($results); }
  
  return $results;
}
/*************************************************************************************************************************************/
function getSemesterData ($html) {
  $domd = new DOMDocument(); //Create Document Object Model
  libxml_use_internal_errors(true);
  $domd->loadHTML($html);
  libxml_use_internal_errors(false);
  
  $semester = $domd->getElementsByTagName("option");
  
  for($i=0; $i < $semester->length; $i++) { 
    $semesterData[$i][0] = $domd->saveXML($semester->item($i)); 
  } //get data between <>this<>
  $i = 0;
  foreach ($semester as $semester) { //gets data from attribute value, necessary for getting further statistical data from page
    $semesterData[$i][1] = $semester->getAttribute('value');
    $i++;
  }
  //print semesterData foreach($semesterData as $key => $value ) { foreach($value as $val) { print_r($value); } } 
  return $semesterData;
}
/*************************************************************************************************************************************/
function createDataTable ($html) {
  $domd = new DOMDocument(); //Create Document Object Model
  libxml_use_internal_errors(true);
  $domd->loadHTML($html);
  libxml_use_internal_errors(false);
    
  $noOfStudents = getData($domd, 'td');
  $countries = getData($domd, 'th');
   
  $data = array_combine($countries, $noOfStudents);
  
  return $data;
}
/*************************************************************************************************************************************/
function getData($domd, $string) {
  $dataset = $domd->getElementsByTagName($string);
  $i=0;
  foreach ($dataset as $key => $value) { 
    $data[$i] = $domd->saveXML($dataset->item($key));
    $i++;
  }
  
  unset($data[0]);
  unset($data[1]);
  if(strip_tags($data[2]) == 'Anzahl'){ unset($data[2]); }
  
  $data = array_values($data);
  
  foreach ($data as $key => $value) {
    $value = strip_tags($value);
    if( (strlen($value) == 2) && !(is_numeric($value)) ){
      unset($data[$key]);
    }
  }
  $data = array_values($data);
  return $data;
}
/*************************************************************************************************************************************/
class arrayToXML extends DomDocument {
    public $nodeName; 
    private $root;
    private $node_name;

    public function __construct($root, $node_name='dataset') {
        parent::__construct();
        $this->encoding = "ISO-8859-1"; // set the encoding 
        $this->formatOutput = true; // format the output
        $this->node_name = $node_name; // set the node names
        $this->root = $this->appendChild($this->createElement($root)); // create the root element
    }
    //creates the XML representation of the array
    public function createNode($array, $node) {
        if (is_null($node)) { $node = $this->root; }
        
        foreach($array as $element => $value) {
            $element = is_numeric( $element ) ? $this->node_name : $element;
            $element = strip_tags($element);
            
            if(!is_array($value)) {
              $value = strip_tags($value);
              $element = $element;
            }
            
            $child = $this->createElement($element, (is_array($value) ? NULL : $value));
            $node->appendChild($child);
            
            if (is_array($value)) { self::createNode($value, $child); }
        }
    }
    // Return the generated XML as a string
    public function __toString() { $this->save("test.xml"); //return $this->saveXML(); 
     }
} 
?>