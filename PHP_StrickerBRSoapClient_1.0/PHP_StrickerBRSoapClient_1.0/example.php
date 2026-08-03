<?php

/*
 * 
 * Example Stricker Version 1.1
 * 
 */
 
// Switch off the cache
ini_set('soap.wsdl_cache', 0);
ini_set('soap.wsdl_cache_limit', 0);
ini_set('soap.wsdl_cache_ttl', 0);
ini_set('soap.wsdl_cache_enabled', 0);
ini_set('max_execution_time', 0);
ini_set('memory_limit', '1024M'); // or you could use 1G
set_time_limit(0);

// Start language arrays
$lang = array("NL" => "NL", "EN" => "EN", "FR" => "FR", "DE" => "DE", "IT" => "IT", "PL" => "PL", "PT" => "PT", "RU" => "RU", "ES" => "ES", "CZ" => "CZ", "SK" => "SK",
						"BG" => "BG", "HR" => "HR", "DK" => "DK", "FI" => "FI", "GR" => "GR", "HU" => "HU", "NO" => "NO", "RO" => "RO", "RS" => "RS", "SE" => "SE", "UA" => "UA");

// Include the client soap to communicate with the webservice methods
require_once("StrickerSoapClient.php");

// Create a new instance for the webservice client
$protocol = 'http';
$webservice = new StrickerSoapClient($protocol);

// Start session
session_start();

/*--------------------------------------------------------------------------------------------------------------*/

/* Insert you private access key */
$access_key = '';

/* Define your language*/
$selectedLang = $lang["EN"];

// Initialize variables
$valid = false;
$token = "";

function Authorize(&$webservice, &$access_key, &$valid, &$token)
{
	// Authorize the client according to credentials and save token in session
	$response = $webservice->AuthenticateClient($access_key);
	
	echo '<pre>'; print_r($response); echo '</pre>';
	
	// If there was any error, show the error
	if($response->ErrorCode != null)
	{
		print_r("ERROR CODE : ".$response->ErrorCode."<br/>");
		print_r("ERROR MESSAGE : ".$response->ErrorMessage."<br/>");
	}
	// If access key is valid, save the session token
	else
	{
		$valid = true;
		$_SESSION["token"] = $response->Token;
		$token = $response->Token;
	}
}

// Ask for authentication
try 
{
	// If no session token exists, ask for a new token
	if(!isset($_SESSION["token"]))
	{
		Authorize($webservice, $access_key, $valid, $token);
	}
	// If session token exists, check if it is still valid
	else
	{
		$token = $_SESSION["token"];
		
		// Validate authenticity of session 
		$response = $webservice->ValidateSession($token);
		//echo '<pre>'; print_r($response); echo '</pre>';
		
		// Session token is valid, continue
		if($response->Status)
		{
			$valid = true;
		}
		// Session token expired
		else
		{
			Authorize($webservice, $access_key, $valid, $token);
		}
	}
	if($valid)
	{
		#region Products
		/* List of products, product reference, name, description
		 * 	Parameters:
		 * 	$token: session token
		 *  $lang: language
		 */
		 
		//$data = $webservice->Products($token,$selectedLang);
		//echo 'Products :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion

		#region Optionals
		/* List of products optionals, product sku, colors, sizes
		* 	Parameters:
		* 	$token: session token
		*  $lang: language
		*/
		 
		// $data = $webservice->Optionals($token, $selectedLang);
		// echo 'Optionals :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion

		#region OptionalsComplete
		/* List of products optionals with product specification, product reference, name, description, product sku, colors, sizes
		* 	Parameters:
		* 	$token: session token
		*  $lang: language
		*/
		 
		// $data = $webservice->OptionalsComplete($token,$selectedLang);
		// echo 'Optionals Complete :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion
		
		#region CustomizationOptions
		/* List of customization options, product reference, component, location, area, technique, price
		* 	Parameters:
		* 	$token: session token
		*  $lang: language
		*/
		 
		// $data = $webservice->CustomizationOptions($token,$selectedLang);
		// echo 'Customization options :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion
		
		#region Stocks
		/* List of product stocks, and next arrivals, product sku, stock 
		* 	Parameters:
		* 	$token: session token
		*  $lang: language
		*/
		 
		// $data = $webservice->Stocks($token, $selectedLang);
		// echo 'Stocks :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion
		
		#region CustomizationTables
		/* List of Customization price tables
		* 	Parameters:
		* 	$token: session token
		*  $lang: language
		*/
		 
		// $data = $webservice->CustomizationTables($token,$selectedLang);
		// echo 'Customization Tables :<br/><pre>'; print_r($data); echo '</pre>';	 
		#endregion
		
		#region ProductsTree
		/* List of ProductsTree, all information about product, product specification, colors, sizes, customization options, prices.
		* 	Parameters:
		* 	$token: session token
		*  $lang: language
		*/
		 
		// $data = $webservice->ProductsTree($token,$selectedLang);
		// echo 'Products Tree :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion

		#region Create Order & Create Service Order
		/* Create order
		* Parameters :
		* $token : session token	
		*/
		
		/* Couriers
			ECONOMY
			EXPRESS
		*/
		/**/

		// $orderLine1 = Array( "LineType" => "Simple", "Sku" => "30504-103-P", "Quantity" => "1" );
		// $orderLine2 = Array( 
		// 	"LineType" => "PRINT",
		// 	"Sku" => "30504-103-P", 
		// 	"Quantity" => "1",
		// 	"WaitArtWork" => true
		//  );
		// $order = Array($orderLine1, $orderLine2);
		
		// $destination = Array(
		// 	"AddressLine1" => "Street name",
		// 	"AddressLine2" => "Door number",
		// 	"Postalcode" => "1000",
		// 	"ExtentionPostalcode" => "",
		// 	"City" => "City",
		// 	"Country" => "BR",
		// 	"PhoneNumber" => "93243232",
		//  "State" => "SP",
		// );
		// $internalReference = "";
		
		// //For development purposes
		
		// $test = true;
		// $data = $webservice->CreateOrder($token, $order, $destination, "ECONOMY", "Testing", $internalReference, null, null, false, $test);

		// echo 'CreateOrder :<br/><pre>'; print_r($data); echo '</pre>';

		// $orderStamp = $data->OrderV1Result->OrderDetails->OrderStamp;
		// $objectOrderLine = null;
		// foreach ($data->OrderV1Result->OrderDetails->OrderLines->OrderLineV1 as $key => $value) {
		// 	$objectOrderLine = $value;

		// 	$status = $objectOrderLine->Status;

		// 	// NOTE VERY IMPORTANT -> You must save $objectOrderLine->OrderLineStamp in your system in order to process the art work later.

		// 	if(trim($status) == "WAITING_ART_WORK"){
		// 		$OrderLineStamp = $objectOrderLine->OrderLineStamp;

		// 		$fileExampleByes = file_get_contents("example.jpg");

		// 		$arrayServiceFiles = array(
		// 			array(
		// 					"FileName" => "test",
		// 					"FileExtension" => ".jpg",
		// 					"FileBytes" => $fileExampleByes 
		// 				)
		// 		);

		// 		$arrayOrderServiceOrder = array(
		// 			array(
		// 				"OrderLineStamp" => $OrderLineStamp,
		// 				"Appproved" => true,
		// 				"LogoArea" => 2.25,
		// 				"LogoHeight" => 1.5,
		// 				"LogoWidth" => 1.5,
		// 				"ServCode" => "30504.39.40.TRS1-01-03",
		// 				"Files" => $arrayServiceFiles
		// 			)
		// 		);

		// 		$data = $webservice->CreateServiceOrder($token, $orderStamp, $arrayOrderServiceOrder, true);
		// 		echo 'Orders :<br/><pre>'; print_r($data); echo '</pre>';

		// 	}
		// }
		
		#endregion		

		#region Orders List

		/* List of orders, order code, order value, and date
		* Parameters :
		* $token : session token
		*/
		
		// "Empty" => "",
		// "WAITING_ART_WORK" => "WAITING_ART_WORK",
		// "WAITING_ART_WORK_AND_STOCK" => "WAITING_ART_WORK_AND_STOCK",
		// "NEW" => "NEW",
		// "PROCESSING" => "PROCESSING",
		// "WAITING_STOCK" => "WAITING_STOCK",
		// "PROCESSED" => "PROCESSED",
		// "PENDING_MOCKUP_APPROVAL" => "PENDING_MOCKUP_APPROVAL",
		// "INVOICED" => "INVOICED",
		// "SENT" => "SENT",
		// "CANCELED" => "CANCELED"

		
		// $data = $webservice->OrderList($token, "Empty", 10, true);
		// echo 'Orders :<br/><pre>'; print_r($data); echo '</pre>';
		
		#endregion

		#region Colors
		/* List of color codes and names
		 * 	Parameters:
		 * 	$token: session token
		 *  $lang: language
		*/
		 
		// $data = $webservice->Colors($token, $selectedLang);
		// echo 'Colors :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion

		#region ProductTypes
		/* List of product types (description, sub-types)
		 * 	Parameters:
		 * 	$token: session token
		 *  $lang: language
		*/
		 
		// $data = $webservice->ProductTypes($token, $selectedLang);
		// echo 'Product Types :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion

		#region CatalogPrices
		/* List with catalog prices for each product
		 * 	Parameters:
		 * 	$token: session token
		*/
		
		$data = $webservice->CatalogPrices($token);
		echo 'Catalog Prices :<br/><pre>'; print_r($data); echo '</pre>';
		#endregion
		
		#region CloseSession
		/* Closes the session
		 * 	Parameters:
		 * 	$token: session token
		 *  $lang: language
		 */
		 
		//$data = $webservice->CloseSession($token);
		//echo 'Session closed <br/><pre>'; print_r($data); echo '</pre>';
		#endregion
		
		#region CanceledProducts
		/* List of canceled products
		 * 	Parameters:
		 * 	$token: session token
		 */
		 
		//$data = $webservice->CanceledProducts($token);
		//echo 'Canceled products:<br/><pre>'; print_r($data); echo '</pre>';
		#endregion		
		
	}
}catch(Exception $ex)
{
	echo '<pre>'; print_r($ex); echo '</pre>';
}	



?>
