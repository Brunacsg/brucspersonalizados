<?php

/**
 * WebService REST Client v1.1
 *
 * @service StrickerRestClient
 */
 
class StrickerRestClient{

    public $lang = array("PT" => "PT");

    public $MethodType = "GET";

    // Access Token
    private $accessURL = "authenticateclient?accesskey={your_accesskey}";
	
    // ValidateSession
    private $validateSessionURL = "validateSession?token={session_token}";
	
    // ProductsTree
    private $productsTreeURL = "productsTree?token={session_token}&lang={language}";
	
    // Products
    private $productsURL = "products?token={session_token}&lang={language}";
	
    // Optionals
    private $optionalsURL = "optionals?token={session_token}&lang={language}";
	
    // OptionalsComplete
    private $optionalscompleteURL = "optionalscomplete?token={session_token}&lang={language}";
	
    // CustomizationOptions
    private $customizationOptionsURL = "customizationOptions?token={session_token}&lang={language}";
	
    // CustomizationTables
    private $customizationTablesURL = "customizationTables?token={session_token}&lang={language}";
	
    // Stocks
    private $stocksURL = "stocks?token={session_token}&lang={language}";
    
	// Colors
    private $colorsURL = "colors?token={session_token}&lang={language}";
    
	//CatalogPrices
	private $catalogPricesURL = "CatalogPrices?token={session_token}";
	
	// Create Order
    private $orderURL = "orderv1?token={session_token}&test={test}";
    
	//fill artwork of order
    private $artWorkOrder = "ServiceOrderV1?token={session_token}&test={test}";
    
	//fill product types
    private $productTypesURL = "ProductTypes?token={session_token}";

	//fill product types
    private $canceledProductsURL = "CanceledProducts?token={session_token}";
	
    public $Token = "";
    public $Host = "ws.spotgifts.com.br";
    public $PublicToken = "";
    public $Language = "";

	public $Protocol = "";
	public $urlHTTP = "http://ws.spotgifts.com.br/api/v1/";
	public $urlHTTPS = "https://ws.spotgifts.com.br/api/v1SSL/";
	
    public function StrickerRestClient($publicKey = "", $protocol = "", $lang = "PT"){   
        
        session_start();
        
        if(isset($_SESSION['PublicKey']) && trim($_SESSION['PublicKey']) !== ""){
            $this->PublicToken = trim($_SESSION['PublicKey']);
        }else{
            $this->PublicToken = $publicKey;
            $_SESSION['PublicKey'] = $this->PublicToken;
        }

        $this->Language = $this->lang[$lang];
		
		$this->Protocol = $protocol;

        $resultJson = $this->Autenticate($this->PublicToken);
        if(isset($resultJson->Token)){
            $this->Token = $resultJson->Token;
        }
    }

    public function MakeRequest($url, $data, $arrayToReplace, $method = "", $content = false){

        if(trim($method) === ""){
            $method = $this->MethodType;
        }

        $arrayHeader = array(
            'Host: '.$this->Host.'',
            'Accept: application/json',
            'Content-Type: application/json'
        );
        $options = array(
            'http' => array(
                'header'  => $arrayHeader,
                'method'  => $method,

            )
        );

        if($data !== null){

            $data = json_encode($data);

            print_r($data);

            $options["http"]["content"] = $data;
        }

        if($content){

            $options["http"]["header"][] = "Content-Length: ". strlen($data);

        }

        $context = stream_context_create($options);
		
		if($this->Protocol == "http")
			$urlRequest = $this->urlHTTP . $url;
		
		else
			$urlRequest = $this->urlHTTPS . $url;
		
        foreach ($arrayToReplace as $key => $value) {
            // $value = urldecode($value);
            $urlRequest = str_replace($key, $value, $urlRequest);
        }

        $result = file_get_contents( $urlRequest , false, $context);

        return $result;
    }


    public function Autenticate($publicKey, $revalidateToken = false){

        $result = $this->MakeRequest($this->accessURL, null, array("{your_accesskey}" => $publicKey));          

        $resultJson = json_decode($result);

        if($revalidateToken){
            if(isset($resultJson->Token)){
                $this->Token = $resultJson->Token;
            }   
        }
        return $resultJson; 
    }

    public function ValidateToken(){
        if(trim($this->Token) === ""){
            $this->Autenticate($this->PublicToken, true);
            return "New Token ".$this->Token." was created.";
        }else{
            $result = $this->MakeRequest($this->validateSessionURL, null, array("{session_token}" =>  $this->Token));

            $resultJson = json_decode($result);

            if(isset($resultJson->Status)){
                if(trim($resultJson->Status) === "1"){
                    return "Token ".$this->Token." is valid.";
                }else{
                    $this->Autenticate($this->PublicToken, true);
                    return "New Token ".$this->Token." was created.";
                }
            }  
        }
    }

    public function GetProductsTree(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->productsTreeURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }

    public function GetProducts(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->productsURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }

    public function GetProductTypes(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->productTypesURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }

    public function GetOptionals(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->optionalsURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }
    
    public function GetOptionalsComplete(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->optionalscompleteURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }
    
    public function GetCustomizationsOptions(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->customizationOptionsURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }
    
    public function GetCustomizationsTables(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->customizationTablesURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }
    
    public function GetStocks(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->stocksURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }

    public function GetColors(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->colorsURL, null, array(
            "{language}" => $this->Language,
            "{session_token}" => $this->Token
        ));

        return $result;
    }
    
    /**
     * CreateOrder
     *
     * NOTE VERY IMPORTANT -> You must save OrderLineStamp field from this request response, in your system in order to process the art work later (using the method CreateServiceOrder).
	 * 
	 * 
	 * @param  mixed $order
	 * 
     * $orderLine1 = Array( "LineType" => "Simple", "Sku" => "30504-103-P", "Quantity" => "1" );
	 * $orderLine2 = Array( 
	 * 	  "LineType" => "PRINT",
	 * 	  "Sku" => "30504-103-P", 
	 * 	  "Quantity" => "1",
	 * 	  "WaitArtWork" => true
	 *  );
	 * $order = Array($orderLine1, $orderLine2);
	 * 
	 * @param  mixed $destination
	 * 
	 * $destination = Array(
	 * 	  "AddressLine1" => "Street name",
	 * 	  "AddressLine2" => "Door number",
	 * 	  "Postalcode" => "1000",
	 * 	  "ExtentionPostalcode" => "",
	 * 	  "City" => "City",
	 * 	  "Country" => "BR",
	 * 	  "PhoneNumber" => "93243232",
		  "State" => "SP",
	 * );
	 * 
	 * @param  mixed $courier
	 * 
	 * 	Example: "ECONOMY"
	 * 
	 * @param  mixed $observation
	 * 
	 *  Example: "Testing" or ""
	 * 
	 * @param  mixed $internalReference
	 * 
	 *  Your id of the order in your system.
	 * 
	 * @param  mixed $relatedOrderStamp
	 * 
	 *  Related Order Stamp or null.
	 * 
	 * @param  mixed $shippingDate
	 * 
	 * 	Date to Ship this order.
	 * 
	 * @param  mixed $noShipping
	 * 
	 *  Indicate wether this order has shipping (true) or not (false).
	 * 
	 * @param  mixed $test
	 * 
	 * This variable determine if the request is to be inserted in prod or dev envoyrement
     * 
     * @return DataObject
     */
    public function CreateOrder($order, $destination, $courier, $observation = "", $internalReference = "", $relatedOrderStamp = null,
     $shippingDate = null, $noShipping = false, $test = false){

        $this->ValidateToken();

        $arrayData = array(
            'order' => $order, 
            'destination' => $destination,
            'courier' => $courier,
            'observation' => $observation,
            'internalReference' => $internalReference,
            'relatedOrderStamp' => $relatedOrderStamp,
            'shippingDate' => $shippingDate,
            'noShipping' => $noShipping,
        );

        $result = $this->MakeRequest($this->orderURL, $arrayData, 
            array(
                "{session_token}" => $this->Token,
                "{test}"=> (($test === 0) ? "false" : "true")
            ), 
            "POST"
        );

        $result = json_decode($result);

        return $result;
    }
    
    /**
     * CreateOrderWithArtWork
     *
     * @param  mixed $orderStamp
     * 
     * Get orderStamp from {Response from CreateOrder}->OrderV1Result->OrderDetails->OrderStamp
     * 
     * @param  mixed $arrayOrderServiceOrder
     * 
     * $fileExampleByes = file_get_contents("PATH_TO_FILE");
	 *
	 * 		$arrayServiceFiles = array(
	 * 			array(
	 * 					"FileName" => "test",
	 * 					"FileExtension" => "txt",
	 * 					"FileBytes" => $fileExampleByes 
	 * 				)
	 * 		);
	 *
	 * 		$serviceOrdersArray = array(
	 * 			array(
	 * 				"OrderLineStamp" => $OrderLineStamp,
	 * 				"Appproved" => true,
	 * 				"LogoArea" => 2.25,
	 * 				"LogoHeight" => 1.5,
	 * 				"LogoWidth" => 1.5,
	 * 				"ServCode" => "30504.39.40.TRS1-01-03",
	 * 				"Files" => $arrayServiceFiles
	 * 			)
	 * 		);
     * 
     * @param  mixed $test
     * 
     * This variable determine if the request is to be inserted in prod or dev envoyrement
     * 
     * @return DataObject
     */
    public function CreateOrderWithArtWork($orderStamp, $arrayOrderServiceOrder, $test = false){
        
        $this->ValidateToken();

        $arrayData = array(
            'orderStamp' => $orderStamp, 
            'order' => $arrayOrderServiceOrder
        );

        $result = $this->MakeRequest($this->artWorkOrder, $arrayData, 
            array(
                "{session_token}" => $this->Token,
                "{test}"=> (($test === 0) ? "false" : "true")
            ), 
            "POST", true
        );

        return $result;
    }
	
	public function GetCatalogPrices(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->catalogPricesURL, null, array(
            "{session_token}" => $this->Token
        ));

        return $result;
    }
	
	public function GetCanceledProducts(){
        $this->ValidateToken();

        $result = $this->MakeRequest($this->canceledProductsURL, null, array(
            "{session_token}" => $this->Token
        ));

        return $result;
    }	
}

?>